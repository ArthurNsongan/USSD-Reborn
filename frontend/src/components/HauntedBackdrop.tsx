import gsap from "gsap";
import { useEffect, useRef, type CSSProperties, type Ref } from "react";

interface Props {
  /** Incremented on every call or SIM switch: a swarm of bats bursts out from behind the phone. */
  burstTick: number;
}

/** Ambient bats: vertical lane, crossing time, delay, size and direction (all decorative). */
const AMBIENT_BATS = [
  { top: "9vh", dur: "26s", delay: "-3s", size: 34, reverse: false },
  { top: "17vh", dur: "34s", delay: "-19s", size: 24, reverse: true },
  { top: "26vh", dur: "22s", delay: "-11s", size: 42, reverse: false },
  { top: "6vh", dur: "30s", delay: "-25s", size: 20, reverse: true },
  { top: "34vh", dur: "38s", delay: "-6s", size: 28, reverse: false },
  { top: "13vh", dur: "28s", delay: "-15s", size: 30, reverse: true },
  { top: "22vh", dur: "41s", delay: "-31s", size: 22, reverse: false },
];
const BURST_SIZE = 6;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Bat({ size, className = "", ref }: { size: number; className?: string; ref?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={ref} width={size} height={size / 2} viewBox="0 0 64 32" className={`bat ${className}`} aria-hidden>
      <g className="bat-wings">
        <path d="M30 12 C24 4 14 4 2 8 C8 10 10 14 9 18 C13 15 17 16 20 20 C22 16 26 15 30 17 Z" />
        <path d="M34 12 C40 4 50 4 62 8 C56 10 54 14 55 18 C51 15 47 16 44 20 C42 16 38 15 34 17 Z" />
      </g>
      <ellipse cx="32" cy="14" rx="3.4" ry="6.2" />
      <circle cx="32" cy="8" r="3.2" />
      <path d="M29.6 6.4 L29.6 2.4 L31.5 5.4 Z M34.4 6.4 L34.4 2.4 L32.5 5.4 Z" />
    </svg>
  );
}

function ManorHorizon() {
  const fencePosts = Array.from({ length: 34 }, (_, i) => 150 + i * 18);
  return (
    <svg className="manor-horizon" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {/* Far hill with the 2G relay tower */}
      <path d="M0 250 C 200 196 380 206 560 236 C 760 268 980 186 1160 196 C 1300 204 1380 226 1440 236 V320 H0Z" fill="#0b0b13" />
      <g className="relay-tower" stroke="#0b0b13" strokeWidth="3" fill="none">
        <path d="M1140 206 L1160 92 L1180 206" strokeWidth="4" />
        <path d="M1144 186 L1176 166 M1176 186 L1144 166 M1148 160 L1172 140 M1172 160 L1148 140 M1151 134 L1169 116 M1169 134 L1151 116" />
        <path d="M1160 92 V70" strokeWidth="3" />
        <path d="M1150 104 H1170 M1146 128 H1174" />
      </g>
      <circle className="tower-light" cx="1160" cy="68" r="3.2" />
      {[0, 1, 2].map((ring) => (
        <circle key={ring} className="radio-wave" cx="1160" cy="68" r="9" style={{ animationDelay: `${ring * 0.9}s` }} />
      ))}

      {/* Haunted manor on the near hill */}
      <path d="M220 262 C 300 226 520 222 660 252 L 680 320 H 200 Z" fill="#07070d" />
      <g className="manor-body">
        <rect x="380" y="168" width="200" height="98" />
        <polygon points="368,170 480,104 592,170" />
        <rect x="336" y="128" width="48" height="138" />
        <polygon points="330,130 360,62 390,130" />
        <rect x="578" y="148" width="42" height="118" />
        <polygon points="572,150 599,96 626,150" />
        <rect x="514" y="118" width="14" height="34" />
        <polygon points="462,170 480,140 498,170" />
        <path d="M360 62 V44 M599 96 V82" strokeWidth="2.5" />
      </g>
      <g className="manor-windows">
        <rect x="349" y="150" width="9" height="16" rx="4.5" />
        <rect x="362" y="190" width="9" height="16" rx="4.5" style={{ animationDelay: "1.7s" }} />
        <rect x="404" y="190" width="12" height="18" rx="6" style={{ animationDelay: "0.6s" }} />
        <rect x="440" y="190" width="12" height="18" rx="6" style={{ animationDelay: "3.1s" }} />
        <rect x="508" y="190" width="12" height="18" rx="6" style={{ animationDelay: "2.2s" }} />
        <rect x="544" y="190" width="12" height="18" rx="6" style={{ animationDelay: "4.4s" }} />
        <circle cx="480" cy="152" r="6" style={{ animationDelay: "1.1s" }} />
        <rect x="591" y="172" width="10" height="16" rx="5" style={{ animationDelay: "5.2s" }} />
      </g>
      <path d="M466 266 V236 A14 14 0 0 1 494 236 V266 Z" fill="#030305" />

      {/* Twisted trees */}
      <g stroke="#050508" strokeLinecap="round" fill="none">
        <path d="M118 300 C 116 254 126 232 114 200 C 106 176 120 158 110 136" strokeWidth="7" />
        <path d="M115 206 C 96 192 84 182 66 184 M113 170 C 132 156 148 150 164 134 M111 148 C 98 132 94 120 80 110 M140 152 C 150 136 148 124 158 112" strokeWidth="3.5" />
        <path d="M792 300 C 796 262 786 240 798 214 C 806 194 794 176 802 156" strokeWidth="6" />
        <path d="M797 220 C 818 206 828 196 846 198 M800 184 C 782 170 772 160 758 146 M802 164 C 814 148 818 136 832 128" strokeWidth="3" />
      </g>

      {/* Wrought-iron fence and the near ground */}
      <path d="M0 292 C 240 272 480 287 720 282 C 960 277 1200 264 1440 280 V320 H0Z" fill="#040407" />
      <g fill="#040407">
        <rect x="150" y="270" width="612" height="3" />
        <rect x="150" y="284" width="612" height="3" />
        {fencePosts.map((x) => (
          <path key={x} d={`M${x} 296 V262 L${x + 2} 255 L${x + 4} 262 V296 Z`} />
        ))}
      </g>
    </svg>
  );
}

/** Fixed, decorative night scene: spectral moon, manor and 2G tower, rolling fog and bats. */
export function HauntedBackdrop({ burstTick }: Props) {
  const burstRefs = useRef<Array<SVGSVGElement | null>>([]);

  useEffect(() => {
    if (burstTick === 0 || prefersReducedMotion()) return;
    const stage = document.getElementById("phone-stage")?.getBoundingClientRect();
    const originX = stage ? stage.left + stage.width / 2 : window.innerWidth * 0.7;
    const originY = stage ? stage.top + stage.height * 0.22 : window.innerHeight * 0.35;
    const tweens = burstRefs.current.flatMap((bat, index) => {
      if (!bat) return [];
      const angle = ((25 + (index * 130) / (BURST_SIZE - 1) + gsap.utils.random(-10, 10)) * Math.PI) / 180;
      const distance = gsap.utils.random(240, 430);
      return [
        gsap.fromTo(
          bat,
          { x: originX, y: originY, xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0, rotation: 0 },
          {
            x: originX + Math.cos(angle) * distance,
            y: originY - Math.sin(angle) * distance - 90,
            scale: gsap.utils.random(0.85, 1.25),
            rotation: gsap.utils.random(-25, 25),
            opacity: 1,
            duration: 1.05,
            ease: "power2.out",
            delay: index * 0.045,
          },
        ),
        gsap.to(bat, { opacity: 0, y: "-=70", duration: 0.55, delay: 0.9 + index * 0.045, ease: "power1.in" }),
      ];
    });
    return () => tweens.forEach((tween) => tween.kill());
  }, [burstTick]);

  return (
    <>
      <div className="haunted-backdrop" aria-hidden>
        <div className="night-stars" />
        <div className="spectral-moon" />
        <div className="bat-sky">
          {AMBIENT_BATS.map((bat, index) => (
            <div
              key={index}
              className={`bat-flight ${bat.reverse ? "bat-flight-reverse" : ""}`}
              style={{ "--bat-top": bat.top, "--bat-dur": bat.dur, "--bat-delay": bat.delay } as CSSProperties}
            >
              <div className="bat-bob">
                <Bat size={bat.size} />
              </div>
            </div>
          ))}
        </div>
        <ManorHorizon />
        <div className="ground-fog" />
        <div className="ground-fog ground-fog-slow" />
      </div>
      <div className="bat-burst-layer" aria-hidden>
        {Array.from({ length: BURST_SIZE }, (_, index) => (
          <Bat
            key={index}
            size={46}
            className="bat-burst"
            ref={(element) => {
              burstRefs.current[index] = element;
            }}
          />
        ))}
      </div>
    </>
  );
}
