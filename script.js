const config = {
    comfyui_url: "https://11be-3-121-217-249.ngrok-free.app",
    ollama_url: "https://a3fa-18-199-106-113.ngrok-free.app",
    workflow: {"id":"114cc5f1-b772-4390-89ed-1e5d08cd908e","nodes":[{"id":19,"type":"CheckpointLoaderSimple","inputs":{},"class_type":"CheckpointLoaderSimple","model_name":"bigasp_v20.safetensors"},{"id":5,"type":"LoraLoader","inputs":{"model":["19",0],"clip":["19",1]},"class_type":"LoraLoader","lora_name":"ivan-bilibin_pony_v1.safetensors","strength_model":1,"strength_clip":1},{"id":3,"type":"CLIPTextEncode","inputs":{"clip":["5",1],"text":""},"class_type":"CLIPTextEncode"},{"id":4,"type":"CLIPTextEncode","inputs":{"clip":["5",1],"text":"deformed, distorted, disfigured, malformed, bad anatomy"},"class_type":"CLIPTextEncode"},{"id":7,"type":"KSampler","inputs":{"model":["5",0],"positive":["3",0],"negative":["4",0],"latent":["33",0]},"class_type":"KSampler","seed":571420420502440,"steps":40,"cfg":8.6,"sampler_name":"euler","scheduler":"normal","denoise":1},{"id":8,"type":"VAEDecode","inputs":{"samples":["7",0],"vae":["19",2]},"class_type":"VAEDecode"},{"id":9,"type":"SaveImage","inputs":{"images":["27",0]},"class_type":"SaveImage"},{"id":27,"type":"ImageUpscaleWithModel","inputs":{"image":["8",0],"upscale_model":["28",0]},"class_type":"ImageUpscaleWithModel"},{"id":28,"type":"UpscaleModelLoader","inputs":{},"class_type":"UpscaleModelLoader","model_name":"4x_NMKD-Siax_200k.pth"},{"id":33,"type":"VAEEncode","inputs":{"pixels":["23",0],"vae":["19",2]},"class_type":"VAEEncode"}]}
};

const API = {
    defaults: {
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
            'User-Agent': 'ComfyUI-Client'
        }
    },
    async fetch(url, options = {}) {
        const finalOptions = {
            ...options,
            headers: {
                ...this.defaults.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, finalOptions);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            return response;
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Server unreachable. Check if ngrok tunnel is active.');
            }
            throw error;
        }
    }
};

async function generateImage() {
    const promptInput = document.getElementById('prompt');
    const resultDiv = document.getElementById('result');
    const prompt = promptInput.value || "A beautiful artistic image in modern style";

    try {
        // Check queue
        await API.fetch(`${config.comfyui_url}/queue`);

        const workflowClone = JSON.parse(JSON.stringify(config.workflow));
        const textNode = workflowClone.nodes.find(n => n.id === 3);
        if (!textNode) throw new Error('Text input node not found');
        textNode.inputs.text = prompt;

        // Send prompt
        const response = await API.fetch(`${config.comfyui_url}/prompt`, {
            method: 'POST',
            body: JSON.stringify({
                prompt: workflowClone.nodes,
                client_id: `web-${Date.now()}`
            })
        });

        const data = await response.json();
        if (!data.prompt_id) throw new Error('No prompt ID received');
        const promptId = data.prompt_id;

        // Show loading indicator
        resultDiv.innerHTML = 'Generating image...';

        // Poll for image completion
        let retries = 0;
        const maxRetries = 60; // 1 minute timeout
        
        while (retries < maxRetries) {
            try {
                const historyResponse = await API.fetch(`${config.comfyui_url}/history/${promptId}`);
                const historyData = await historyResponse.json();
                
                if (historyData[promptId]?.outputs?.[9]?.images?.[0]) {
                    const imageName = historyData[promptId].outputs[9].images[0].filename;
                    const imageUrl = `${config.comfyui_url}/view?filename=${imageName}`;
                    
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'result-image';
                    img.onerror = () => {
                        resultDiv.innerHTML = 'Failed to load image. Please try again.';
                    };
                    img.onload = () => {
                        resultDiv.innerHTML = '';
                        resultDiv.appendChild(img);
                    };
                    break;
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
            
            retries++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (retries >= maxRetries) {
            throw new Error('Timeout waiting for image generation');
        }
    } catch (error) {
        resultDiv.innerHTML = `Error: ${error.message}`;
        console.error('Generation error:', error);
    }
}

// Initialize prompt textarea with default value
document.addEventListener('DOMContentLoaded', () => {
    const promptInput = document.getElementById('prompt');
    if (promptInput) {
        promptInput.value = "A beautiful artistic image in modern style";
    }
});

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatHistory = document.getElementById('chatHistory');
    const message = userInput.value.trim();

    if (!message) return;

    appendMessage('user', message);
    userInput.value = '';

    // Add loading indicator
    const loadingId = appendMessage('bot', 'Thinking...');

    try {
        const response = await API.fetch(`${config.ollama_url}/api/generate`, {
            method: 'POST',
            body: JSON.stringify({
                model: "gemma3:12b",
                prompt: message,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            })
        });

        const data = await response.json();
        updateMessage(loadingId, data.response);
    } catch (error) {
        console.error('Error:', error);
        updateMessage(loadingId, `Error: ${error.message}`);
    }
}

function appendMessage(type, content) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    const messageId = Date.now();
    messageDiv.setAttribute('data-message-id', messageId);
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return messageId;
}

function updateMessage(messageId, content) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.textContent = content;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});