const config = {
    comfyui_url: "https://52d4-18-199-106-113.ngrok-free.app",
    workflow: {
        "3": {
            "inputs": {
                "text": "",
                "clip": ["4", 0]
            },
            "class_type": "CLIPTextEncode"
        },
        "4": {
            "inputs": {
                "model_name": "sdxl_base_1.0.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "text": "bad quality, low resolution, blurry, pixelated",
                "clip": ["4", 0]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["10", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": "ComfyUI",
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        },
        "10": {
            "inputs": {
                "model": ["4", 0],
                "positive": ["3", 0],
                "negative": ["5", 0],
                "latent_size": [1024, 1024],
                "seed": 5371638474,
                "steps": 20,
                "cfg": 7,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1
            },
            "class_type": "KSampler"
        }
    }
};

async function generateImage() {
    const promptInput = document.getElementById('prompt');
    const resultDiv = document.getElementById('result');
    const prompt = promptInput.value || "A beautiful artistic image in modern style";

    try {
        // Clone the workflow and update the prompt
        const workflow = JSON.parse(JSON.stringify(config.workflow));
        workflow["3"].inputs.text = prompt;

        // Send prompt to ComfyUI
        const response = await fetch(`${config.comfyui_url}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: workflow
            })
        });

        if (!response.ok) throw new Error('Failed to send prompt');
        
        const data = await response.json();
        const promptId = data.prompt_id;

        // Poll for image completion
        while (true) {
            const historyResponse = await fetch(`${config.comfyui_url}/history/${promptId}`);
            const historyData = await historyResponse.json();
            
            if (historyData[promptId]?.outputs?.[9]?.images?.[0]) {
                const imageName = historyData[promptId].outputs[9].images[0].filename;
                const imageUrl = `${config.comfyui_url}/view?filename=${imageName}`;
                
                const img = document.createElement('img');
                img.src = imageUrl;
                img.className = 'result-image';
                
                resultDiv.innerHTML = '';
                resultDiv.appendChild(img);
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        resultDiv.innerHTML = `Error: ${error.message}`;
        console.error(error);
    }
}

// Initialize prompt textarea with default value
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prompt').value = "A beautiful artistic image in modern style";
});