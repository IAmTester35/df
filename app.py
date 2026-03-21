import os
from flask import Flask, render_template, request, jsonify
from transformers import AutoModel, AutoProcessor
from PIL import Image
import torch
import io

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize PaddleOCR-VL
print("Loading PaddleOCR-VL (this may take a few minutes)...")
model_id = "PaddlePaddle/PaddleOCR-VL"

# Use CPU for compatibility, but MPS if available on Mac
device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

# Load model and processor
model = AutoModel.from_pretrained(
    model_id, 
    trust_remote_code=True, 
    torch_dtype=torch.float32 # Use float32 for CPU/MPS stability
).to(device)
processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
print("Model loaded successfully.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ocr', methods=['POST'])
def ocr():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image selected'}), 400
    
    try:
        # Load image using PIL
        image = Image.open(io.BytesIO(file.read())).convert("RGB")
        
        # Prepare inputs for the model
        # The prompt for PaddleOCR-VL-0.9B is typically "<ocr>"
        query = "<ocr>"
        inputs = processor(text=query, images=image, return_tensors="pt").to(device)
        
        # Generate OCR results
        with torch.no_grad():
            outputs = model.generate(
                **inputs, 
                max_new_tokens=2048,
                do_sample=False
            )
        
        # Decode the output
        decoded_text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
        
        # Clean up the output if it contains the prompt
        if decoded_text.startswith(query):
            decoded_text = decoded_text[len(query):].strip()
            
        return jsonify({
            'text': decoded_text,
            'count': 1 # VL model returns a single string result
        })
        
    except Exception as e:
        print(f"Error during OCR: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Using port 5001 to avoid conflicts
    app.run(debug=False, port=5001)
