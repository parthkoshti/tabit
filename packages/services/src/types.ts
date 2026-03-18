export type Success<T> = { success: true; data: T };
export type Failure<E = string> = { success: false; error: E; status: number };
export type Result<T, E = string> = Success<T> | Failure<E>;

export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

export function err<E = string>(error: E, status: number = 400): Failure<E> {
  return { success: false, error, status };
}
