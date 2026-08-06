import { Grid, Home, BookOpen, Sofa, Laptop, Bike, Shirt, Package, Star } from "lucide-react";

export const CATEGORIES = [
  { id: "all", label: "All Categories", icon: Grid },
  { id: "movein", label: "Move-In Essentials", icon: Home },
  { id: "textbooks", label: "Textbooks", icon: BookOpen },
  { id: "furniture", label: "Dorm Furniture", icon: Sofa },
  { id: "electronics", label: "Electronics", icon: Laptop },
  { id: "bikes", label: "Bikes & Transport", icon: Bike },
  { id: "clothing", label: "Clothing & Greek", icon: Shirt },
  { id: "supplies", label: "School Supplies", icon: Package },
  { id: "services", label: "Student Services", icon: Star },
];

export const CONDITIONS = ["Like New", "Excellent", "Good", "Fair", "Service"];
