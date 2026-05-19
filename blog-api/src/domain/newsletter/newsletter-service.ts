export interface INewsletterService {
  subscribe(email: string): Promise<void>;
}
