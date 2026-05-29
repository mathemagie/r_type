// FX layer — screen shake, hit-stop, slow-mo, flash
const FX = (() => {
  let shakeAmp = 0, shakeDecay = 0;
  let hitStop = 0;        // frames remaining at 0 timescale
  let slowmo = 0;          // ms remaining of slow-motion
  let flashAlpha = 0, flashColor = '#ffffff';

  return {
    shake(amount) { shakeAmp = Math.max(shakeAmp, amount); shakeDecay = 0.86; },
    hitstop(ms) { hitStop = Math.max(hitStop, ms); },
    slowmo(ms) { slowmo = Math.max(slowmo, ms); },
    flash(color = '#ffffff', alpha = 0.6) {
      flashColor = color;
      flashAlpha = Math.max(flashAlpha, alpha);
    },

    // Returns timescale multiplier for this frame (0..1)
    timescale(dt) {
      if (hitStop > 0) {
        hitStop = Math.max(0, hitStop - dt);
        return 0.03;
      }
      if (slowmo > 0) {
        slowmo = Math.max(0, slowmo - dt);
        return 0.35;
      }
      return 1;
    },

    update(dt) {
      shakeAmp *= shakeDecay;
      if (shakeAmp < 0.05) shakeAmp = 0;
      flashAlpha *= 0.85;
      if (flashAlpha < 0.01) flashAlpha = 0;
    },

    preDraw(ctx) {
      if (shakeAmp > 0) {
        const dx = (Math.random() - 0.5) * shakeAmp * 2;
        const dy = (Math.random() - 0.5) * shakeAmp * 2;
        ctx.save();
        ctx.translate(dx, dy);
      } else {
        ctx.save();
      }
    },

    postDraw(ctx, w, h) {
      ctx.restore();
      if (flashAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    },

    reset() {
      shakeAmp = 0; hitStop = 0; slowmo = 0; flashAlpha = 0;
    }
  };
})();
