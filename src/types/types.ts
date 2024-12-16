export interface Ingredient {
  name: string;
  amount: string;
  special?: boolean;
  optional?: boolean;
  unique?: boolean;
  type?: string;
  parens?: string;
  substitutions?: string[];
}

export interface Direction {
  sectionTitle: string;
  steps: string[];
  editStep?: number;
}

export type Directions = Direction[];

export interface Recipe {
  id: string;
  title: string;
}

export interface RegisterUserFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}
