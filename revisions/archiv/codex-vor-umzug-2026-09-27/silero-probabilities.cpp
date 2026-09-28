#include "common-whisper.h"
#include "whisper.h"
#include "ggml-backend.h"
#include <cmath>
#include <cstdio>
#include <vector>

// Expose probabilities before whisper.cpp's fixed 200 ms segment merging.
// Silero 6.2.0 in whisper.cpp 1.9.4 uses 512 samples per 16 kHz window.
static void quiet_log(enum ggml_log_level, const char *, void *) {}

int main(int argc, char ** argv) {
    if (argc != 3) {
        std::fprintf(stderr, "Usage: silero-probabilities MODEL AUDIO\n");
        return 2;
    }
    whisper_log_set(quiet_log, nullptr);
    ggml_backend_load_all();
    std::vector<float> mono;
    std::vector<std::vector<float>> channels;
    if (!read_audio_data(argv[2], mono, channels, false) || mono.empty()) return 3;
    auto params = whisper_vad_default_context_params();
    params.use_gpu = false;
    params.n_threads = 4;
    auto * ctx = whisper_vad_init_from_file_with_params(argv[1], params);
    if (!ctx) return 4;
    if (!whisper_vad_detect_speech(ctx, mono.data(), mono.size())) {
        whisper_vad_free(ctx);
        return 5;
    }
    const int count = whisper_vad_n_probs(ctx);
    const float * probabilities = whisper_vad_probs(ctx);
    const int expected = (mono.size() + 511) / 512;
    if (count != expected || !probabilities) {
        std::fprintf(stderr, "Unexpected model window count: %d vs %d\n", count, expected);
        whisper_vad_free(ctx);
        return 6;
    }
    for (int i = 0; i < count; i++) {
        if (!std::isfinite(probabilities[i]) || probabilities[i] < 0 || probabilities[i] > 1) {
            whisper_vad_free(ctx);
            return 7;
        }
    }
    std::printf("{\"sampleRate\":16000,\"hopSamples\":512,\"sampleCount\":%zu,\"probabilities\":[", mono.size());
    for (int i = 0; i < count; i++) std::printf("%s%.8f", i ? "," : "", probabilities[i]);
    std::printf("]}\n");
    whisper_vad_free(ctx);
    return 0;
}
