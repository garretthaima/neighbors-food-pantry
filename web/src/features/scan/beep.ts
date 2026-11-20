let audio: AudioContext | undefined;

/** A short high blip for a good scan, a low buzz for a problem. */
export function beep(ok: boolean) {
    try {
        audio ??= new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = ok ? 'sine' : 'square';
        oscillator.frequency.value = ok ? 880 : 200;
        gain.gain.value = 0.07;
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + (ok ? 0.09 : 0.3));
    } catch {
        // Sound is a nicety; scanning works without it.
    }
}
