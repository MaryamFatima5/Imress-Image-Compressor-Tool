from flask import Flask, render_template, request, send_file, jsonify
import os
from PIL import Image
import io
import zipfile

app = Flask(__name__)


@app.route('/')
def home():
    return render_template('index.html')


def compress_single_image(file):
    """Ek image ko compress karke (bytes, filename) wapas deta hai"""
    original_filename = file.filename
    name, ext = os.path.splitext(original_filename)
    ext = ext.lower()

    img = Image.open(file)

    # Format detect karein original extension se
    format_map = {
        '.jpg': 'JPEG',
        '.jpeg': 'JPEG',
        '.png': 'PNG',
        '.webp': 'WEBP'
    }
    img_format = format_map.get(ext, 'JPEG')

    # JPEG transparency support nahi karta, isliye RGBA ko RGB mein convert karein
    if img_format == 'JPEG' and img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    img_io = io.BytesIO()

    if img_format == 'JPEG':
        img.save(img_io, format=img_format, quality=50, optimize=True)
    elif img_format == 'PNG':
        try:
            if img.mode == 'RGBA':
                img_quantized = img.quantize(colors=256, method=Image.MEDIANCUT)
            else:
                img_quantized = img.convert('P', palette=Image.ADAPTIVE, colors=256)
            img_quantized.save(img_io, format=img_format, optimize=True, compress_level=9)
        except Exception:
            # Agar quantize fail ho to simple compress karein
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA')
            img.save(img_io, format=img_format, optimize=True, compress_level=9)
    elif img_format == 'WEBP':
        img.save(img_io, format=img_format, quality=50)

    img_io.seek(0)

    return img_io, original_filename


@app.route('/compress', methods=['POST'])
def compress_image():
    """Single image compress karke wapas bhejta hai (individual download ke liye)"""
    if 'image' not in request.files:
        return 'No image uploaded', 400

    file = request.files['image']
    img_io, filename = compress_single_image(file)

    return send_file(
        img_io,
        mimetype='application/octet-stream',
        as_attachment=True,
        download_name=filename
    )


@app.route('/compress-zip', methods=['POST'])
def compress_images_zip():
    """Multiple images compress karke ek ZIP file mein bhejta hai"""
    files = request.files.getlist('images')

    if not files:
        return 'No images uploaded', 400

    zip_io = io.BytesIO()

    with zipfile.ZipFile(zip_io, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file in files:
            img_io, filename = compress_single_image(file)
            zip_file.writestr(filename, img_io.read())

    zip_io.seek(0)

    return send_file(
        zip_io,
        mimetype='application/zip',
        as_attachment=True,
        download_name='compressed_images.zip'
    )


if __name__ == '__main__':
    app.run(debug=True)