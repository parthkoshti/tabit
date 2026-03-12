import { useCallback, useState } from "react";

const STORAGE_KEY = "speech_recognition_settings";

export type SpeechRecognitionSettings = {
  lang: string;
  autoStart: boolean;
};

const DEFAULTS: SpeechRecognitionSettings = {
  lang: "en-US",
  autoStart: false,
};

function readSettings(): SpeechRecognitionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function writeSettings(settings: SpeechRecognitionSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSpeechRecognitionSettings() {
  const [settings, setSettings] = useState<SpeechRecognitionSettings>(() =>
    readSettings(),
  );

  const update = useCallback((patch: Partial<SpeechRecognitionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}

export const SPEECH_RECOGNITION_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "nl-NL", label: "Dutch" },
  { value: "pl-PL", label: "Polish" },
  { value: "ru-RU", label: "Russian" },
  { value: "sv-SE", label: "Swedish" },
  { value: "tr-TR", label: "Turkish" },
  { value: "ar-SA", label: "Arabic" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
] as const;
