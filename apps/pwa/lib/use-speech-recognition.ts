import { useCallback, useEffect, useRef, useState } from "react";

function getSpeechRecognition(): typeof SpeechRecognition | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function useSpeechRecognition(options?: {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognition>> | null>(null);
  const onResultRef = useRef(options?.onResult);
  const onErrorRef = useRef(options?.onError);

  onResultRef.current = options?.onResult;
  onErrorRef.current = options?.onError;

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition());
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      const msg = "Speech recognition is not supported in this browser";
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    setError(null);

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          onResultRef.current?.(transcript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed") {
          setError("Microphone access denied");
          onErrorRef.current?.("Microphone access denied");
        } else if (event.error === "no-speech") {
          setError("No speech detected");
          onErrorRef.current?.("No speech detected");
        } else {
          setError(event.error);
          onErrorRef.current?.(event.error);
        }
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, error, start, stop, toggle };
}
