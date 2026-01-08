
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const nodes = [
  { id: 'Intake', x: 50, y: 150, active: false },
  { id: 'Quote', x: 250, y: 150, active: true },
  { id: 'Human Approval', x: 450, y: 150, active: false },
  { id: 'Schedule', x: 650, y: 150, active: false },
];

const links = [
  { source: 'Intake', target: 'Quote' },
  { source: 'Quote', target: 'Human Approval' },
  { source: 'Human Approval', target: 'Schedule' },
];

const WorkflowVisualizer = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Workflows</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-64 w-full">
          <svg className="h-full w-full" viewBox="0 0 700 300">
            {links.map((link, i) => {
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              if (!sourceNode || !targetNode) return null;
              return (
                <line
                  key={i}
                  x1={sourceNode.x + 50}
                  y1={sourceNode.y}
                  x2={targetNode.x - 50}
                  y2={targetNode.y}
                  stroke="#9ca3af"
                />
              );
            })}
            {nodes.map(node => (
              <g key={node.id} transform={`translate(${node.x - 50},${node.y - 25})`}>
                <rect width="100" height="50" rx="8" fill="#f3f4f6" stroke="#e5e7eb" />
                <text x="50" y="30" textAnchor="middle" fill="#4b5563">
                  {node.id}
                </text>
                {node.active && (
                  <circle
                    cx="50"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="#15803d"
                    strokeWidth="2"
                  >
                    <animate
                      attributeName="r"
                      from="20"
                      to="40"
                      dur="1.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="1"
                      to="0"
                      dur="1.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowVisualizer;
