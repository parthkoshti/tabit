import { createElement, type ComponentProps } from "react";
import {
  Link as TanStackLink,
  useNavigate as useTanStackNavigate,
  useParams as useTanStackParams,
  useLocation,
  useRouter,
  type NavigateOptions,
} from "@tanstack/react-router";

export { useLocation, useRouter };

type NavigateTo = Parameters<ReturnType<typeof useTanStackNavigate>>[0];

export function useNavigate() {
  const navigate = useTanStackNavigate();
  return (
    to: string | number | NavigateTo,
    options?: { replace?: boolean; state?: unknown },
  ) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    if (typeof to === "string") {
      return navigate({
        to,
        replace: options?.replace,
        state: options?.state,
      } as NavigateOptions);
    }
    return navigate(to);
  };
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string>,
>(): T {
  return useTanStackParams({ strict: false } as never) as T;
}

type AppLinkProps = Omit<ComponentProps<typeof TanStackLink>, "to"> & {
  to: string;
};

export function Link(props: AppLinkProps) {
  return createElement(TanStackLink, {
    ...(props as ComponentProps<typeof TanStackLink>),
    to: props.to as ComponentProps<typeof TanStackLink>["to"],
  });
}

export function useSearchParams(): [
  URLSearchParams,
  (
    next:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean },
  ) => void,
] {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.searchStr ?? "");

  const setSearchParams = (
    next:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean },
  ) => {
    const prev = new URLSearchParams(location.searchStr ?? "");
    const resolved =
      typeof next === "function"
        ? next(prev)
        : next instanceof URLSearchParams
          ? next
          : new URLSearchParams(next);
    const qs = resolved.toString();
    const href =
      location.pathname + (qs ? `?${qs}` : "") + (location.hash ?? "");
    if (options?.replace) {
      window.history.replaceState(null, "", href);
    } else {
      window.history.pushState(null, "", href);
    }
  };

  return [searchParams, setSearchParams];
}
