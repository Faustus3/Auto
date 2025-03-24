const config = {
    comfyui_url: "https://52d4-18-199-106-113.ngrok-free.app",
    workflow: {"id":"114cc5f1-b772-4390-89ed-1e5d08cd908e","nodes":[{"id":19,"type":"CheckpointLoaderSimple","inputs":{},"class_type":"CheckpointLoaderSimple","model_name":"bigasp_v20.safetensors"},{"id":5,"type":"LoraLoader","inputs":{"model":["19",0],"clip":["19",1]},"class_type":"LoraLoader","lora_name":"ivan-bilibin_pony_v1.safetensors","strength_model":1,"strength_clip":1},{"id":3,"type":"CLIPTextEncode","inputs":{"clip":["5",1],"text":""},"class_type":"CLIPTextEncode"},{"id":4,"type":"CLIPTextEncode","inputs":{"clip":["5",1],"text":"deformed, distorted, disfigured, malformed, bad anatomy"},"class_type":"CLIPTextEncode"},{"id":7,"type":"KSampler","inputs":{"model":["5",0],"positive":["3",0],"negative":["4",0],"latent":["33",0]},"class_type":"KSampler","seed":571420420502440,"steps":40,"cfg":8.6,"sampler_name":"euler","scheduler":"normal","denoise":1},{"id":8,"type":"VAEDecode","inputs":{"samples":["7",0],"vae":["19",2]},"class_type":"VAEDecode"},{"id":9,"type":"SaveImage","inputs":{"images":["27",0]},"class_type":"SaveImage"},{"id":27,"type":"ImageUpscaleWithModel","inputs":{"image":["8",0],"upscale_model":["28",0]},"class_type":"ImageUpscaleWithModel"},{"id":28,"type":"UpscaleModelLoader","inputs":{},"class_type":"UpscaleModelLoader","model_name":"4x_NMKD-Siax_200k.pth"},{"id":33,"type":"VAEEncode","inputs":{"pixels":["23",0],"vae":["19",2]},"class_type":"VAEEncode"}]}
};

async function generateImage() {
    const promptInput = document.getElementById('prompt');
    const resultDiv = document.getElementById('result');
    const prompt = promptInput.value || "A beautiful artistic image in modern style";

    try {
        // Clone the workflow and update the prompt
        const workflowClone = JSON.parse(JSON.stringify(config.workflow));
        const textNode = workflowClone.nodes.find(n => n.id === 3);
        if (!textNode) throw new Error('Text input node not found');
        textNode.inputs.text = prompt;

        // Send prompt to ComfyUI
        const response = await fetch(`${config.comfyui_url}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: workflowClone.nodes
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send prompt: ${errorText}`);
        }
        
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
                const historyResponse = await fetch(`${config.comfyui_url}/history/${promptId}`);
                if (!historyResponse.ok) throw new Error('Failed to fetch history');
                
                const historyData = await historyResponse.json();
                if (historyData[promptId]?.outputs?.[9]?.images?.[0]) {
                    const imageName = historyData[promptId].outputs[9].images[0].filename;
                    const imageUrl = `${config.comfyui_url}/view?filename=${imageName}`;
                    
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'result-image';
                    img.onerror = () => {
                        resultDiv.innerHTML = 'Failed to load image';
                    };
                    
                    resultDiv.innerHTML = '';
                    resultDiv.appendChild(img);
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