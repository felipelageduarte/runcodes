cmake_minimum_required(VERSION 3.18)
project(monitor C)

set(CMAKE_C_STANDARD 99)
ADD_COMPILE_OPTIONS(-Wall -Wextra -O2 -D_FORTIFY_SOURCE=2 -fstack-protector-strong)

include_directories(src)
set(SOURCES src/monitor.c src/monitor.h)

add_executable(monitor src/main.c ${SOURCES})
target_link_options(monitor PRIVATE -static)

enable_testing()

add_executable(test_signal_name tests/test_signal_name.c src/monitor.c)
add_test(NAME unit_signal_name COMMAND test_signal_name)

find_program(BASH_PROGRAM bash)
if(BASH_PROGRAM)
    add_test(
        NAME integration
        COMMAND ${BASH_PROGRAM} ${CMAKE_SOURCE_DIR}/tests/integration_test.sh
                $<TARGET_FILE:monitor> ${CMAKE_SOURCE_DIR}/tests/fixtures
    )
    set_tests_properties(integration PROPERTIES TIMEOUT 60)
endif()
