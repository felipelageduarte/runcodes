/* Forks a grandchild that sleeps, then writes a sentinel file. The parent
 * exits immediately, orphaning it. Used to verify the monitor kills the
 * whole process group instead of only its direct child. */
#include <stdio.h>
#include <unistd.h>

int main(void) {
    if (fork() == 0) {
        sleep(5);
        FILE *f = fopen("grandchild_survived", "w");
        if (f)
            fclose(f);
        _exit(0);
    }
    return 0;
}
