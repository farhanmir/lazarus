FROM golang:1.22-alpine AS builder
WORKDIR /build

RUN apk add --no-cache git

COPY go.mod go.sum* ./
RUN go mod download || true

COPY . .
RUN go build -o lazarus ./cmd/lazarus

FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /build/lazarus .
COPY data/ ./data/
COPY index.html .

RUN mkdir -p /tmp/blueprints

EXPOSE 8080
CMD ["./lazarus"]
