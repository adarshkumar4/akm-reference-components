'use strict';

require('dotenv').config();
const mongoUtils = require('./utils/mongoUtils');

// OpenTelemetry instrumentation
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: process.env.OTEL_SERVICE_NAME || 'product-order-processor',
});

// Start OpenTelemetry
try {
  sdk.start();
  console.log('OpenTelemetry initialized');
} catch (error) {
  console.log('Error initializing OpenTelemetry:', error);
}

// Configuration
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10); // Default 5 seconds
const PROCESSING_TIME = parseInt(process.env.PROCESSING_TIME_MS || '10000', 10); // Default 10 seconds
const COLLECTION_NAME = 'productorder';

let isProcessing = false;
let processingCount = 0;

/**
 * Simulate order processing with fake business logic
 * @param {Object} order - The order to process
 * @returns {Promise} Promise that resolves after processing time
 */
async function simulateOrderProcessing(order) {
  console.log(`\n[Order ${order.id}] Starting processing simulation...`);
  console.log(`[Order ${order.id}] Order Date: ${order.orderDate}`);
  console.log(`[Order ${order.id}] Items: ${order.productOrderItem ? order.productOrderItem.length : 0}`);
  
  // Simulate various processing steps
  const steps = [
    { name: 'Validating order items', percentage: 20 },
    { name: 'Checking inventory', percentage: 40 },
    { name: 'Processing payment', percentage: 60 },
    { name: 'Scheduling fulfillment', percentage: 80 },
    { name: 'Finalizing order', percentage: 100 }
  ];
  
  const stepTime = PROCESSING_TIME / steps.length;
  
  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, stepTime));
    console.log(`[Order ${order.id}] ${step.name}... (${step.percentage}%)`);
  }
  
  console.log(`[Order ${order.id}] Processing completed successfully!\n`);
}

/**
 * Process a single order from acknowledged to completed
 */
async function processNextOrder() {
  if (isProcessing) {
    console.log('Already processing an order, skipping this cycle...');
    return;
  }

  try {
    isProcessing = true;
    const db = await mongoUtils.connect();
    
    // Find the oldest acknowledged order
    const order = await db.collection(COLLECTION_NAME)
      .findOne(
        { state: 'acknowledged' },
        { sort: { orderDate: 1 } }
      );
    
    if (!order) {
      console.log('No acknowledged orders found, waiting for next cycle...');
      return;
    }
    
    processingCount++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing order #${processingCount}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`${'='.repeat(60)}`);
    
    // Update order state to inProgress
    const updateResult1 = await db.collection(COLLECTION_NAME)
      .updateOne(
        { id: order.id },
        { 
          $set: { 
            state: 'inProgress',
            lastModified: new Date().toISOString()
          } 
        }
      );
    
    if (updateResult1.modifiedCount === 0) {
      console.log(`[Order ${order.id}] Failed to update state to inProgress`);
      return;
    }
    
    console.log(`[Order ${order.id}] State updated: acknowledged -> inProgress`);
    
    // Simulate order processing
    await simulateOrderProcessing(order);
    
    // Update order state to completed
    const completionDate = new Date().toISOString();
    const updateResult2 = await db.collection(COLLECTION_NAME)
      .updateOne(
        { id: order.id },
        { 
          $set: { 
            state: 'completed',
            completionDate: completionDate,
            lastModified: completionDate
          } 
        }
      );
    
    if (updateResult2.modifiedCount === 0) {
      console.log(`[Order ${order.id}] Failed to update state to completed`);
      return;
    }
    
    console.log(`[Order ${order.id}] State updated: inProgress -> completed`);
    console.log(`[Order ${order.id}] Completion Date: ${completionDate}`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error('Error processing order:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the background processor
 */
async function startProcessor() {
  console.log('\n' + '='.repeat(60));
  console.log('Product Order Processor - Background Service');
  console.log('='.repeat(60));
  console.log(`Poll Interval: ${POLL_INTERVAL}ms (${POLL_INTERVAL/1000}s)`);
  console.log(`Processing Time: ${PROCESSING_TIME}ms (${PROCESSING_TIME/1000}s)`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log('='.repeat(60) + '\n');
  
  // Test MongoDB connection
  try {
    await mongoUtils.connect();
    console.log('✓ MongoDB connection established\n');
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
  
  // Start processing loop
  console.log('Starting order processing loop...\n');
  setInterval(processNextOrder, POLL_INTERVAL);
  
  // Process immediately on startup
  processNextOrder();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  mongoUtils.close();
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry shut down'))
    .catch((error) => console.log('Error shutting down OpenTelemetry:', error))
    .finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  mongoUtils.close();
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry shut down'))
    .catch((error) => console.log('Error shutting down OpenTelemetry:', error))
    .finally(() => process.exit(0));
});

// Start the processor
startProcessor().catch(error => {
  console.error('Fatal error starting processor:', error);
  process.exit(1);
});
