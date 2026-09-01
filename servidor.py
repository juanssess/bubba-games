"""
Servidor local de Bubba Games.

Es http.server con dos diferencias:

  1. Manda cabeceras de NO cachear. Sin eso el navegador se queda con la
     version vieja despues de cada cambio y uno termina depurando un sitio
     que es mitad codigo nuevo y mitad viejo. (En produccion el cache SI
     se quiere: por eso los assets llevan ?v=N en index.html.)

  2. Es multihilo. El casino carga ~40 archivos de una y embebe los juegos
     en un iframe; con un servidor de un solo hilo las peticiones se hacen
     cola y la carga se siente lenta o directamente se traba.
"""
import http.server
import sys

PUERTO = 8123


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass   # sin ruido en la consola


if __name__ == '__main__':
    try:
        servidor = http.server.ThreadingHTTPServer(('', PUERTO), SinCache)
    except OSError:
        # Ya hay algo escuchando: casi siempre otra ventana del casino
        # abierta. Avisar es mas util que dejar dos servidores peleandose.
        print('El puerto %d ya esta ocupado.' % PUERTO)
        print('Cerra la otra ventana del casino y volve a intentar.')
        sys.exit(1)

    print('Bubba Games en http://localhost:%d' % PUERTO)
    servidor.serve_forever()
