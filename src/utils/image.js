// Downscale + JPEG-compress an image so it stays legible but fits under vision-API inline
// image limits (NVIDIA caps inline images at ~180KB). Shared by AITutor and the question composer.
const TARGET_IMAGE_CHARS = 180000

export const downscaleImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(url)
    const maxDim = 1280
    let { width, height } = img
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale); height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    let q = 0.82, out = canvas.toDataURL('image/jpeg', q)
    while (out.length > TARGET_IMAGE_CHARS && q > 0.35) { q -= 0.12; out = canvas.toDataURL('image/jpeg', q) }
    resolve(out)
  }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')) }
  img.src = url
})
