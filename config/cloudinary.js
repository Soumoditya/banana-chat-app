const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const CLOUD_NAME = CLOUDINARY_CLOUD_NAME;

export const uploadToCloudinary = async (fileInput, resourceType = 'image') => {
    const MAX_RETRIES = 1;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const formData = new FormData();

            let uri, filename, mimeType;
            if (typeof fileInput === 'string') {
                uri = fileInput;
                filename = (uri && typeof uri.split === 'function') ? uri.split('/').pop() : 'upload.jpg';
            } else if (fileInput && fileInput.uri) {
                uri = fileInput.uri;
                filename = fileInput.fileName || ((uri && typeof uri.split === 'function') ? uri.split('/').pop() : 'upload.jpg');
                mimeType = fileInput.mimeType;
            } else {
                throw new Error("Invalid file input for Cloudinary upload.");
            }

            if (!uri) {
                throw new Error("File URI is empty or undefined.");
            }

            if (!mimeType) {
                const match = /\.(\w+)$/.exec(filename || '');
                const ext = match ? match[1].toLowerCase() : 'jpg';
                if (resourceType === 'video') {
                    mimeType = `video/${ext === 'mp4' ? 'mp4' : ext}`;
                } else {
                    mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                }
            }

            // Fix Android local URI scheme if missing
            if (!uri.startsWith('file://') && !uri.startsWith('http') && !uri.startsWith('content://')) {
                uri = `file://${uri}`;
            }

            formData.append('file', {
                uri: uri,
                name: filename || 'upload',
                type: mimeType,
            });
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            // Longer timeout for videos (60s), images (30s)
            const timeoutMs = resourceType === 'video' ? 60000 : 30000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
                {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal,
                    // DO NOT set Content-Type header — React Native auto-generates 
                    // the correct multipart boundary. Setting it manually breaks uploads.
                }
            );
            clearTimeout(timeoutId);

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            return {
                url: data.secure_url,
                publicId: data.public_id,
                width: data.width,
                height: data.height,
                format: data.format,
                duration: data.duration,
            };
        } catch (error) {
            lastError = error;
            console.warn(`Cloudinary upload attempt ${attempt + 1} failed:`, error.message);
            if (attempt < MAX_RETRIES) {
                // Wait 1s before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    console.error('Cloudinary upload failed after retries:', lastError);
    throw lastError;
};

export const getCloudinaryUrl = (publicId, options = {}) => {
    const { width, height, crop = 'fill', quality = 'auto' } = options;
    let transformations = `q_${quality}`;
    if (width) transformations += `,w_${width}`;
    if (height) transformations += `,h_${height}`;
    if (crop) transformations += `,c_${crop}`;

    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
};
