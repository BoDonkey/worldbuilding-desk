import React from 'react';
import type {GameRule, ResourceDefinition, StatDefinition, WorldRuleset} from '@litrpg-tool/rules-engine';

export interface ReviewStepProps {
  ruleset: WorldRuleset;
  onEdit: (step: number) => void;
}

export function ReviewStep({ruleset, onEdit}: ReviewStepProps) {
  return (
    <div className='review-step'>
      <div className='step-header'>
        <h2>Review Your World</h2>
        <p>Review your settings before creating your world</p>
      </div>

      <div className='review-sections'>
        {/* World Info */}
        <div className='review-section'>
          <div className='review-section-header'>
            <h3>World Information</h3>
            <button onClick={() => onEdit(0)} className='btn-link'>
              Edit
            </button>
          </div>
          <div className='review-section-content'>
            <div className='review-item'>
              <span className='review-label'>Name:</span>
              <span className='review-value'>
                {ruleset.name || 'Untitled World'}
              </span>
            </div>
            <div className='review-item'>
              <span className='review-label'>Description:</span>
              <span className='review-value'>
                {ruleset.description || 'No description'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className='review-section'>
          <div className='review-section-header'>
            <h3>Character Stats</h3>
            <button onClick={() => onEdit(1)} className='btn-link'>
              Edit
            </button>
          </div>
          <div className='review-section-content'>
            {ruleset.statDefinitions.length === 0 ? (
              <p className='review-empty'>
                No stats defined (narrative-only world)
              </p>
            ) : (
              <div className='review-stats-grid'>
                {ruleset.statDefinitions.map((stat: StatDefinition) => (
                  <div key={stat.id} className='review-stat-card'>
                    <strong>{stat.name}</strong>
                    <span className='review-stat-type'>{stat.type}</span>
                    {stat.type === 'number' && (
                      <span className='review-stat-range'>
                        {stat.min !== undefined ? `${stat.min}–` : ''}
                        {stat.max !== undefined ? stat.max : '∞'}
                      </span>
                    )}
                    <span className='review-stat-default'>
                      Default: {String(stat.defaultValue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className='review-summary'>
              {ruleset.statDefinitions.length} stat
              {ruleset.statDefinitions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className='review-section'>
          <div className='review-section-header'>
            <h3>Resources</h3>
            <button onClick={() => onEdit(2)} className='btn-link'>
              Edit
            </button>
          </div>
          <div className='review-section-content'>
            {ruleset.resourceDefinitions.length === 0 ? (
              <p className='review-empty'>No resources defined</p>
            ) : (
              <div className='review-resources-list'>
                {ruleset.resourceDefinitions.map((resource: ResourceDefinition) => (
                  <div key={resource.id} className='review-resource-card'>
                    <div className='review-resource-header'>
                      <strong>{resource.name}</strong>
                      {resource.regeneration?.enabled && (
                        <span className='review-resource-badge'>
                          Regenerates
                        </span>
                      )}
                    </div>
                    <div className='review-resource-details'>
                      <span>Default: {resource.defaultValue}</span>
                      {resource.max && <span>Max: {resource.max}</span>}
                      {resource.regeneration?.enabled && (
                        <span>
                          +{resource.regeneration.rate} per{' '}
                          {resource.regeneration.interval}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className='review-summary'>
              {ruleset.resourceDefinitions.length} resource
              {ruleset.resourceDefinitions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className='review-section'>
          <div className='review-section-header'>
            <h3>Rules</h3>
          </div>
          <div className='review-section-content'>
            {ruleset.rules.length === 0 ? (
              <p className='review-empty'>
                No rules defined yet (you can add these later)
              </p>
            ) : (
              <div className='review-rules-list'>
                {ruleset.rules.map((rule: GameRule) => (
                  <div key={rule.id} className='review-rule-card'>
                    <strong>{rule.name}</strong>
                    <span className='review-rule-category'>
                      {rule.category}
                    </span>
                    {rule.description && (
                      <p className='review-rule-description'>
                        {rule.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className='review-summary'>
              {ruleset.rules.length} rule{ruleset.rules.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className='review-actions'>
        <div className='review-notice'>
          <p>
            You can always modify these settings later or add more rules after
            creating your world.
          </p>
        </div>
      </div>
    </div>
  );
}
