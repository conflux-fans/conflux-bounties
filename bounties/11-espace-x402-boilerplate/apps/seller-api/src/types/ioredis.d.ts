declare module "ioredis" {
  class Redis {
    constructor(url: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    publish(channel: string, message: string): Promise<number>;
    psubscribe(...patterns: string[]): Promise<void>;
    on(event: string, listener: (...args: string[]) => void): this;
  }
  export default Redis;
}
