import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AnalyticsCategoryPane,
  type AnalyticsCategory,
  ANALYTICS_CATEGORIES,
} from "@/components/panes/AnalyticsCategoryPane";
import { AnalyticsDetailPane } from "@/components/panes/AnalyticsDetailPane";
import { AppShell } from "@/components/layout/AppShell";

// Valid category IDs for URL validation
const VALID_CATEGORY_IDS = ANALYTICS_CATEGORIES.map((c) => c.id);

export default function Analytics() {
  const { category: urlCategory } = useParams<{ category?: string }>();
  const navigate = useNavigate();

  // --- Pane System Logic ---
  // Selected category for the 2nd pane (category list) and 3rd pane (detail view)
  const [selectedCategory, setSelectedCategory] =
    useState<AnalyticsCategory | null>(null);

  // --- Deep Link Handling ---
  // On initial load, read category from URL and validate
  useEffect(() => {
    if (urlCategory) {
      // Validate the category from URL
      if (VALID_CATEGORY_IDS.includes(urlCategory as AnalyticsCategory)) {
        if (selectedCategory !== urlCategory) {
          setSelectedCategory(urlCategory as AnalyticsCategory);
        }
      } else {
        // Invalid category in URL, redirect to base analytics
        navigate("/analytics", { replace: true });
      }
    } else {
      // Auto-select first category ('overview') if no URL category
      const firstCategory = ANALYTICS_CATEGORIES[0];
      if (firstCategory && selectedCategory !== firstCategory.id) {
        setSelectedCategory(firstCategory.id);
        navigate(`/analytics/${firstCategory.id}`, { replace: true });
      }
    }
  }, [urlCategory, navigate, selectedCategory]);

  // Sync URL when selectedCategory changes (for user interactions)
  useEffect(() => {
    // Skip URL sync on initial load (handled by urlCategory effect above)
    // Only sync when category changes via user interaction
    if (selectedCategory && selectedCategory !== urlCategory) {
      navigate(`/analytics/${selectedCategory}`, { replace: true });
    } else if (!selectedCategory && urlCategory) {
      // If category is deselected, go back to base analytics URL
      navigate("/analytics", { replace: true });
    }
  }, [selectedCategory, urlCategory, navigate]);

  // --- Pane System Handlers ---
  // Handle category selection from the 2nd pane
  const handleCategorySelect = useCallback((category: AnalyticsCategory) => {
    setSelectedCategory(category);
  }, []);

  // Handle closing the detail pane (3rd pane)
  const handleCloseDetailPane = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Handle back navigation (for mobile)
  const handleBackFromDetail = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  return (
    <AppShell
      config={{
        secondaryPane: (
          <AnalyticsCategoryPane
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        ),
        showDetailPane: false,
      }}
    >
      {/* Analytics Detail Pane - shown when category is selected */}
      {selectedCategory && (
        <AnalyticsDetailPane
          category={selectedCategory}
          onClose={handleCloseDetailPane}
          onBack={handleBackFromDetail}
          showBackButton={false}
        />
      )}
    </AppShell>
  );
}
