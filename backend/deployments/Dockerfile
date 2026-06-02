FROM golang:1.26-alpine AS compiler
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/restaurant-api ./cmd/api

FROM alpine:3.22
COPY --from=compiler /bin/restaurant-api /bin/restaurant-api
EXPOSE 8080
ENTRYPOINT ["/bin/restaurant-api"]
