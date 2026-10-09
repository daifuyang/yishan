import { nextOpportunityStage } from '../../domain/statuses';

test('normal stages advance one step and terminal actions are separate', () => {
  expect(nextOpportunityStage('needs_confirmation')).toBe('solution');
  expect(nextOpportunityStage('solution')).toBe('quotation');
  expect(nextOpportunityStage('quotation')).toBe('negotiation');
  expect(nextOpportunityStage('negotiation')).toBeUndefined();
  expect(nextOpportunityStage('won')).toBeUndefined();
  expect(nextOpportunityStage('lost')).toBeUndefined();
});
