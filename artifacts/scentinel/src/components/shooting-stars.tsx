import { useEffect, useRef, useCallback } from "react";

interface ShootingStarParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  size: number;
  opacity: number;
  traveled: number;
  maxTravel: number;
  active: boolean;
  color: string;
  delay: number;
  waitTimer: number;
}

interface ShootingStarsProps {
  minSpeed?: number;
  maxSpeed?: number;
  minDelay?: number;
  maxDelay?: number;
  className?: string;
}

const STAR_COLORS = [
  "rgba(196, 150, 60, ",
  "rgba(232, 192, 104, ",
  "rgba(255, 215, 120, ",
  "rgba(200, 160, 80, ",
  "rgba(255, 240, 180, ",
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createStar(
  id: number,
  width: number,
  height: number,
  minSpeed: number,
  maxSpeed: number,
  minDelay: number,
  maxDelay: number
): ShootingStarParticle {
  const edge = Math.floor(Math.random() * 3);
  let x: number, y: number;

  if (edge === 0) {
    x = randomBetween(0, width);
    y = randomBetween(-20, 0);
  } else if (edge === 1) {
    x = randomBetween(width * 0.5, width + 20);
    y = randomBetween(-20, height * 0.4);
  } else {
    x = randomBetween(width * 0.2, width);
    y = randomBetween(-20, height * 0.2);
  }

  const baseAngle = Math.PI * 0.7;
  const angleVariance = (Math.random() - 0.5) * (Math.PI / 5);
  const angle = baseAngle + angleVariance;

  return {
    id,
    x,
    y,
    angle,
    speed: randomBetween(minSpeed, maxSpeed),
    length: randomBetween(60, 180),
    size: randomBetween(1, 2.5),
    opacity: 0,
    traveled: 0,
    maxTravel: randomBetween(200, 500),
    active: false,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    delay: randomBetween(minDelay, maxDelay),
    waitTimer: 0,
  };
}

export function ShootingStars({
  minSpeed = 8,
  maxSpeed = 22,
  minDelay = 1000,
  maxDelay = 4500,
}: ShootingStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<ShootingStarParticle[]>([]);
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const spawnStar = useCallback((id: number) => {
    const { w, h } = sizeRef.current;
    return createStar(id, w, h, minSpeed, maxSpeed, minDelay, maxDelay);
  }, [minSpeed, maxSpeed, minDelay, maxDelay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      sizeRef.current = { w: canvas.width, h: canvas.height };
    };
    resize();
    window.addEventListener("resize", resize);

    const NUM_STARS = 12;
    starsRef.current = Array.from({ length: NUM_STARS }, (_, i) => {
      const star = spawnStar(i);
      star.waitTimer = randomBetween(0, star.delay);
      return star;
    });

    const draw = (time: number) => {
      const delta = Math.min((time - lastTimeRef.current) / 16.67, 3);
      lastTimeRef.current = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const star of starsRef.current) {
        if (!star.active) {
          star.waitTimer += delta * 16.67;
          if (star.waitTimer >= star.delay) {
            star.active = true;
            star.waitTimer = 0;
          }
          continue;
        }

        const dx = Math.cos(star.angle) * star.speed * delta;
        const dy = Math.sin(star.angle) * star.speed * delta;
        star.x += dx;
        star.y += dy;
        star.traveled += Math.sqrt(dx * dx + dy * dy);

        const progress = star.traveled / star.maxTravel;
        if (progress < 0.2) {
          star.opacity = progress / 0.2;
        } else if (progress > 0.75) {
          star.opacity = 1 - (progress - 0.75) / 0.25;
        } else {
          star.opacity = 1;
        }
        star.opacity = Math.max(0, Math.min(1, star.opacity)) * 0.85;

        if (star.traveled >= star.maxTravel) {
          const newStar = spawnStar(star.id);
          newStar.waitTimer = 0;
          Object.assign(star, newStar);
          continue;
        }

        const tailX = star.x - Math.cos(star.angle) * star.length;
        const tailY = star.y - Math.sin(star.angle) * star.length;

        const grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
        grad.addColorStop(0, `${star.color}0)`);
        grad.addColorStop(0.6, `${star.color}${(star.opacity * 0.4).toFixed(2)})`);
        grad.addColorStop(1, `${star.color}${star.opacity.toFixed(2)})`);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(star.x, star.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = star.size * 0.6;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `${star.color}${star.opacity.toFixed(2)})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `${star.color}${(star.opacity * 0.8).toFixed(2)})`;
        ctx.fill();
        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [spawnStar]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
