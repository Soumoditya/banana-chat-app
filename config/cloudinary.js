const CLOUDINARY_CLOUD_NAME = 'dpxrtof5z';
const CLOUDINARY_UPLOAD_PRESET = 'banana';

// Cloudinary PID: 9ace8657-4f3b-4242-9768-f72591080822
// The cloud name needs to be set - user can update this
export const CLOUD_NAME = CLOUDINARY_CLOUD_NAME;

export const uploadToCloudinary = async (fileInput, resourceType = 'image') => {
    try {
        const formData = new FormData();

        let uri, filename, mimeType;
        if (typeof fileInput === 'string') {
            uri = fileInput;
            filename = uri.split('/').pop() || 'upload.jpg';
        } else if (fileInput && fileInput.uri) {
            uri = fileInput.uri;
            filename = fileInput.fileName || uri.split('/').pop() || 'upload.jpg';
            mimeType = fileInput.mimeType;
        } else {
            throw new Error("Invalid file input for Cloudinary upload.");
        }
        
        if (!mimeType) {
            const match = /\.(\w+)$/.exec(filename);
            const ext = match ? match[1].toLowerCase() : 'jpg';
            mimeType = ext === 'jpg' ? 'image/jpeg' : `${resourceType}/${ext}`;
        }

        formData.append('file', {
            uri: uri,
            name: filename,
            type: mimeType,
        });
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

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
        console.error('Cloudinary upload error:', error);
        throw error;
    }
};

export const getCloudinaryUrl = (publicId, options = {}) => {
    const { width, height, crop = 'fill', quality = 'auto' } = options;
    let transformations = `q_${quality}`;
    if (width) transformations += `,w_${width}`;
    if (height) transformations += `,h_${height}`;
    if (crop) transformations += `,c_${crop}`;

    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformations}/${publicId}`;
};
