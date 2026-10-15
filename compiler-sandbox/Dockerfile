# Compilation image
FROM debian:trixie-slim AS builder

# Update system
RUN apt-get update && apt-get upgrade -y

# Install build tools
RUN apt-get install -y build-essential cmake libboost-all-dev pkg-config ninja-build

# Create build directory
RUN mkdir /build
WORKDIR /build
COPY ./CMakeLists.txt ./CMakeLists.txt
COPY ./src/ ./src/
# CMakeLists declara os alvos de teste (test_signal_name + integração) —
# sem tests/ no contexto o `cmake .` falha com "No SOURCES given".
COPY ./tests/ ./tests/

# Build project
RUN cmake .
RUN cmake --build .
RUN ctest --output-on-failure

# Create final image with only the built binary
FROM debian:trixie-slim AS dist
COPY --from=builder /build/monitor /usr/bin/monitor
