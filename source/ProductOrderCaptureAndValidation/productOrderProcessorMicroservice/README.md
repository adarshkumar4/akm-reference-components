# Product Order Processor Microservice

## Overview

This is a background processing microservice for the Product Order Capture and Validation ODA Component. It continuously processes Product Orders in the background, moving them through the order lifecycle from `acknowledged` to `completed` state.

## Functionality

The microservice performs the following operations:

1. **Polling**: Every 5 seconds (configurable), queries MongoDB for orders
2. **Selection**: Finds the oldest order with `state = "acknowledged"` (sorted by `orderDate`)
3. **Processing**: 
   - Updates order state to `inProgress`
   - Simulates order processing with business logic (~10 seconds)
   - Updates order state to `completed`
4. **Monitoring**: Integrated with OpenTelemetry for observability

## Configuration

The processor can be configured using environment variables:

### MongoDB Connection
- `MONGODB_HOST`: MongoDB host (default: `localhost`)
- `MONGODB_PORT`: MongoDB port (default: `27017`)
- `MONGODB_DATABASE`: MongoDB database name (default: `tmf`)

### Processing Configuration
- `POLL_INTERVAL_MS`: Time between polling cycles in milliseconds (default: `5000` = 5 seconds)
- `PROCESSING_TIME_MS`: Order processing duration in milliseconds (default: `10000` = 10 seconds)

### OpenTelemetry Configuration
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint (default: `http://localhost:4318/v1/traces`)
- `OTEL_SERVICE_NAME`: Service name for tracing (default: `product-order-processor`)

## Running Locally

### Prerequisites
- Node.js 8.10 or higher
- MongoDB running and accessible
- Product Order API microservice running (to create orders)

### Installation

```bash
cd implementation
npm install
```

### Start the Processor

With default configuration:
```bash
npm start
```

With custom configuration:
```bash
MONGODB_HOST=mongodb-server \
MONGODB_PORT=27017 \
MONGODB_DATABASE=tmf \
POLL_INTERVAL_MS=5000 \
PROCESSING_TIME_MS=10000 \
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Running with Docker

### Build the Docker Image

From the `source/ProductOrderCaptureAndValidation` directory:

```bash
docker build -t product-order-processor:latest -f productorderprocessor-dockerfile .
```

### Run the Container

```bash
docker run -d \
  --name product-order-processor \
  -e MONGODB_HOST=mongodb \
  -e MONGODB_PORT=27017 \
  -e MONGODB_DATABASE=tmf \
  -e POLL_INTERVAL_MS=5000 \
  -e PROCESSING_TIME_MS=10000 \
  product-order-processor:latest
```

## Deployment

### Kubernetes Deployment

The processor should be deployed as a Deployment (not a StatefulSet) with a single replica to ensure sequential processing of orders.

Example deployment configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-order-processor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: product-order-processor
  template:
    metadata:
      labels:
        app: product-order-processor
    spec:
      containers:
      - name: processor
        image: product-order-processor:latest
        env:
        - name: MONGODB_HOST
          value: "mongodb-service"
        - name: MONGODB_PORT
          value: "27017"
        - name: MONGODB_DATABASE
          value: "tmf"
        - name: POLL_INTERVAL_MS
          value: "5000"
        - name: PROCESSING_TIME_MS
          value: "10000"
```

## Processing Logic

The processor implements the following business logic simulation:

1. **Validating order items** (20%)
2. **Checking inventory** (40%)
3. **Processing payment** (60%)
4. **Scheduling fulfillment** (80%)
5. **Finalizing order** (100%)

Each step takes approximately 20% of the configured `PROCESSING_TIME_MS`.

## Monitoring and Observability

### Console Logging

The processor logs detailed information about each processing cycle:

```
==========================================================
Processing order #1
Order ID: urn:uuid:12345678-1234-1234-1234-123456789012
==========================================================

[Order 12345...] State updated: acknowledged -> inProgress
[Order 12345...] Starting processing simulation...
[Order 12345...] Order Date: 2026-06-07T10:30:00.000Z
[Order 12345...] Items: 2
[Order 12345...] Validating order items... (20%)
[Order 12345...] Checking inventory... (40%)
[Order 12345...] Processing payment... (60%)
[Order 12345...] Scheduling fulfillment... (80%)
[Order 12345...] Finalizing order... (100%)
[Order 12345...] Processing completed successfully!

[Order 12345...] State updated: inProgress -> completed
[Order 12345...] Completion Date: 2026-06-07T10:30:15.000Z
==========================================================
```

### OpenTelemetry Traces

The processor is instrumented with OpenTelemetry and exports traces to the configured OTLP endpoint. This enables distributed tracing across the entire order processing workflow.

## Error Handling

- **Connection Errors**: The processor will retry MongoDB connection and log errors
- **Processing Errors**: Errors during order processing are logged and the processor continues with the next cycle
- **Graceful Shutdown**: The processor handles SIGTERM and SIGINT signals for graceful shutdown

## Testing

To test the processor:

1. Start the Product Order API microservice
2. Create orders using the API (they will be in `acknowledged` state)
3. Start the processor microservice
4. Monitor the logs to see orders being processed
5. Query the database to verify order state changes:

```javascript
db.productorder.find({ state: "completed" })
```

## Architecture

The processor follows a simple polling architecture:

```
┌─────────────────────────────────────────┐
│  Product Order Processor                │
│  (Background Service)                   │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  Polling Loop (every 5s)        │  │
│  │  1. Query MongoDB               │  │
│  │  2. Update to "inProgress"      │  │
│  │  3. Process order (~10s)        │  │
│  │  4. Update to "completed"       │  │
│  └─────────────────────────────────┘  │
│           │                             │
└───────────┼─────────────────────────────┘
            │
            ▼
    ┌──────────────┐
    │   MongoDB    │
    │  productorder│
    │  collection  │
    └──────────────┘
```

## License

Apache-2.0

## Related Components

- **Product Order API**: Creates orders in `acknowledged` state
- **Product Catalog API**: Validates product offerings
- **Product Inventory API**: Manages product instances
