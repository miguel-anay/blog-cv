import { describe, it, expect } from 'vitest';
import { sceneWeights } from './sceneWeights';

describe('sceneWeights', () => {
  it('derives weight as clamp(in * (1 - out), 0, 1)', () => {
    sceneWeights.set('hero', 'in', 1);
    sceneWeights.set('hero', 'out', 0);
    sceneWeights.tick();
    expect(sceneWeights.get('hero').weight).toBe(1);

    sceneWeights.set('hero', 'in', 0.5);
    sceneWeights.set('hero', 'out', 0.5);
    sceneWeights.tick();
    expect(sceneWeights.get('hero').weight).toBe(0.25);
  });

  it('clamps weight to 0 when in=1 and out=1', () => {
    sceneWeights.set('hero', 'in', 1);
    sceneWeights.set('hero', 'out', 1);
    sceneWeights.tick();
    expect(sceneWeights.get('hero').weight).toBe(0);
  });

  it('never writes weight directly — only get/set(in|out) and tick() mutate state', () => {
    sceneWeights.set('hero', 'in', 0);
    sceneWeights.set('hero', 'out', 0);
    sceneWeights.tick();
    expect(sceneWeights.get('hero').weight).toBe(0);
  });
});
