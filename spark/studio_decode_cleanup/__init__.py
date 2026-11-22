"""Studio's optional model release between H3 sampling and VAE decoding."""

import comfy.model_management


class StudioDecodeRelease:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"samples": ("LATENT",)}}

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "release"
    CATEGORY = "Studio/Memory"

    def release(self, samples):
        # The sampler has finished. Keep its latent while letting ComfyUI move the
        # H3 model off the card before the video and audio VAEs are loaded.
        comfy.model_management.unload_all_models()
        comfy.model_management.soft_empty_cache()
        return (samples,)


NODE_CLASS_MAPPINGS = {"StudioDecodeRelease": StudioDecodeRelease}
NODE_DISPLAY_NAME_MAPPINGS = {"StudioDecodeRelease": "Studio release H3 before decode"}
