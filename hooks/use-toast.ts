"use client";

export function useToast() {
  const toast = ({ title, description }: { title: string; description?: string; variant?: string }) => {
    if (typeof window !== "undefined") {
      window.alert(title + (description ? `\n\n${description}` : ""));
    }
  };

  return { toast };
}
