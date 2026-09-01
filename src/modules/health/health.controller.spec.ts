import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns service status', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      service: 'event-moments-api',
      status: 'ok',
    });
  });
});
