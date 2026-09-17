import type { ComponentType } from 'react';
import { ResponsivePseudoScatterPlot } from './week-01/ResponsivePseudoScatterPlot';
import { LoadAndDisplayTheDataset } from './week-02/LoadAndDisplayTheDataset';
import { EnhanceTheDisplay } from './week-03/EnhanceTheDisplay';
import { EnhanceTheDisplayMore } from './week-04/EnhanceTheDisplayMore';

export interface Assignment {
  id: string;
  name: string;
  component: ComponentType;
}

export const assignments: Assignment[] = [
  {
    id: '1',
    name: 'Week 1',
    component: ResponsivePseudoScatterPlot,
  },
  {
    id: '2',
    name: 'Week 2',
    component: LoadAndDisplayTheDataset,
  },
  {
    id: '3',
    name: 'Week 3',
    component: EnhanceTheDisplay,
  },
  {
    id: '4',
    name: 'Week 4',
    component: EnhanceTheDisplayMore,
  },
];

export const assignmentsMap = new Map(assignments.map((ex) => [ex.id, ex]));

export const defaultAssignment = '1';
