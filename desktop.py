import threading
import webview
import base64
from app import app

webview.settings['ALLOW_DOWNLOADS'] = True

class Api:
    def save_file(self, filename, base64_data):
        try:
            # Extension ke hisaab se file type filter banayein
            ext = filename.split('.')[-1].lower()

            file_types_map = {
                'zip': ('ZIP Files (*.zip)',),
                'jpg': ('JPEG Image (*.jpg)',),
                'jpeg': ('JPEG Image (*.jpeg)',),
                'png': ('PNG Image (*.png)',),
                'webp': ('WEBP Image (*.webp)',),
            }

            file_types = file_types_map.get(ext, ('All Files (*.*)',))

            save_path = webview.windows[0].create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=filename,
                file_types=file_types
            )

            if not save_path:
                return False

            path = save_path if isinstance(save_path, str) else save_path[0]

            # Agar user ne extension hata diya ho, to wapas add karein
            if not path.lower().endswith('.' + ext):
                path = path + '.' + ext

            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]

            file_bytes = base64.b64decode(base64_data)

            with open(path, 'wb') as f:
                f.write(file_bytes)

            return True
        except Exception as e:
            print("Save error:", e)
            return False


def run_flask():
    app.run(port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    api = Api()

    webview.create_window(
        'Imress - Image Compressor',
        'http://127.0.0.1:5000',
        width=950,
        height=750,
        resizable=True,
        min_size=(700, 600),
        js_api=api
    )

    webview.start()