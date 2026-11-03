export function success<T>(message: string, result: T, created = false) {
  return {
    isSuccess: true,
    code: created ? 'COMMON201' : 'COMMON200',
    message,
    result,
  };
}
