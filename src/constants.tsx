import React from 'react';
import { Calendar, Brain, Mail, BookOpen, CheckSquare, Layers } from 'lucide-react';
import { ProductType } from './types';

export const PRODUCTS: ProductType[] = [
  {
    id: "planner",
    ico: <Calendar className="w-5 h-5" />,
    name: "Planner / Workbook",
    code: "30-day structure",
    spec: "30 daily interactive entries, weekly reflection reviews & comprehensive introduction"
  },
  {
    id: "prompts",
    ico: <Brain className="w-5 h-5" />,
    name: "Prompt Pack",
    code: "50 copy-paste prompts",
    spec: "50 high-value ready-to-use bracketed prompts across 5 key niche categories"
  },
  {
    id: "templates",
    ico: <Mail className="w-5 h-5" />,
    name: "Template Pack",
    code: "25 fill-in scripts",
    spec: "25 customizable captions, templates or message logs with custom blanks and strategies"
  },
  {
    id: "guide",
    ico: <BookOpen className="w-5 h-5" />,
    name: "Mini-Guide / Book",
    code: "~3k word deep-dive",
    spec: "A complete non-fiction playbook including 6-8 chapters loaded with specific guidance"
  },
  {
    id: "checklist",
    ico: <CheckSquare className="w-5 h-5" />,
    name: "Checklist System",
    code: "10-part checklist package",
    spec: "A synchronized set of 10 related checklists with sequential tasks and trigger index"
  },
  {
    id: "swipe",
    ico: <Layers className="w-5 h-5" />,
    name: "Swipe File",
    code: "75 creative hooks",
    spec: "75 highly converting lines, email headers or openers with sectioned applicability guidance"
  }
];
