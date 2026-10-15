"use client";

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

type MusicContextType = {
    playing: boolean;
    toggleMusic: () => void;
};

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const saved =
            localStorage.getItem("musicEnabled") === "true";

        setPlaying(saved);
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;

        const audio = audioRef.current;

        if (!audio) return;

        audio.volume = 0.2;

        if (playing) {
            audio.play().catch(() => {
                setPlaying(false);
                localStorage.setItem(
                    "musicEnabled",
                    "false"
                );
            });
        } else {
            audio.pause();
        }

        localStorage.setItem(
            "musicEnabled",
            String(playing)
        );
    }, [playing, hydrated]);

    function toggleMusic() {
        setPlaying((current) => !current);
    }

    return (
        <MusicContext.Provider
            value={{
                playing,
                toggleMusic,
            }}
        >
            <audio
                ref={audioRef}
                src="/music/background.mp3"
                loop
                preload="auto"
            />

            {children}
        </MusicContext.Provider>
    );
}

export function useMusic() {
    const context = useContext(MusicContext);

    if (!context) {
        throw new Error(
            "useMusic must be used inside MusicProvider"
        );
    }

    return context;
}