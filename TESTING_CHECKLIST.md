# CallVault Testing Checklist

## Pre-Testing Setup

### Environment Configuration
- [ ] Create `.env` file with all required variables
- [ ] Verify Supabase URL and keys are correct
- [ ] Add OpenAI API key
- [ ] Test database connection
- [ ] Confirm edge functions are deployed

### Database Setup
- [ ] Run migration: 20251214_add_insights_tables.sql
- [ ] Run migration: 20251214_add_generated_content.sql
- [ ] Verify all tables exist in Supabase dashboard
- [ ] Check Row Level Security policies are enabled
- [ ] Create test user account

### Application Setup
- [ ] Install dependencies: `npm install`
- [ ] Build application: `npm run build`
- [ ] Start dev server: `npm run dev`
- [ ] Verify application loads at localhost:8080

## UI Testing

### Navigation & Layout
- [ ] Top navigation bar displays correctly
- [ ] Logo and branding visible
- [ ] Search bar functional
- [ ] User menu opens and closes
- [ ] Sidebar expands and collapses
- [ ] Active route highlighting works
- [ ] Responsive design on mobile/tablet/desktop
- [ ] Dark mode toggle works (if implemented)

### Workspaces Home Page
- [ ] Workspace grid displays correctly
- [ ] Workspace cards show gradients
- [ ] Emoji icons render properly
- [ ] Member avatars display
- [ ] Call counts are accurate
- [ ] Filter tabs work (Recent, Favorites, All)
- [ ] Sort options function correctly
- [ ] Grid/List view toggle works
- [ ] Create new workspace button functional
- [ ] Empty state displays when no workspaces

### Insights Page
- [ ] Insights grid displays
- [ ] Insight cards show correct type icons
- [ ] Confidence scores display
- [ ] Tags render correctly
- [ ] Filter by type works
- [ ] Search functionality works
- [ ] Sort options function
- [ ] View context button works
- [ ] Use this button opens content generator
- [ ] Empty state when no insights

### Call Detail Page
- [ ] Call title and metadata display
- [ ] Summary card shows correctly
- [ ] Sentiment badge displays
- [ ] AI processed badge shows when applicable
- [ ] Tabs switch correctly (Insights, Transcript, PROFITS, Actions)
- [ ] Insights tab shows all insights
- [ ] Transcript tab displays full text
- [ ] PROFITS framework organized correctly
- [ ] Action items list properly
- [ ] Generate content button works
- [ ] Share and export buttons functional

### Analytics Page
- [ ] Stat cards display metrics
- [ ] Change indicators show correctly
- [ ] Sentiment distribution chart renders
- [ ] Insight categories chart displays
- [ ] Top topics grid shows data
- [ ] All metrics calculate correctly
- [ ] Data updates when calls are processed

### Transcripts Enhanced Page
- [ ] Auto-processing toggle displays
- [ ] Settings popover opens
- [ ] Processing options can be configured
- [ ] Pending calls section shows unprocessed
- [ ] Processed calls section shows completed
- [ ] Batch selection works
- [ ] Process selected button functional
- [ ] Individual process button works
- [ ] AI status widget appears during processing
- [ ] Upload call button functional

## AI Processing Testing

### Single Call Processing
- [ ] Upload a test call transcript
- [ ] Enable auto-processing
- [ ] Verify AI processing starts automatically
- [ ] Check progress widget displays
- [ ] Confirm insights are extracted
- [ ] Verify summary is generated
- [ ] Check sentiment is detected
- [ ] Confirm action items identified
- [ ] Verify PROFITS framework applied
- [ ] Check all data saved to database

### Batch Processing
- [ ] Select multiple unprocessed calls
- [ ] Click batch process button
- [ ] Verify progress tracking works
- [ ] Check all calls are processed
- [ ] Confirm insights extracted for each
- [ ] Verify error handling for failed calls
- [ ] Check success notification displays

### Content Generation
- [ ] Open content generator modal
- [ ] Select insight type: Email
- [ ] Choose tone: Professional
- [ ] Add target audience
- [ ] Add additional context
- [ ] Click generate button
- [ ] Verify streaming response works
- [ ] Check generated content quality
- [ ] Test copy to clipboard
- [ ] Test download functionality
- [ ] Repeat for Social Post type
- [ ] Repeat for Blog Outline type
- [ ] Repeat for Case Study type

### Auto-Processing Configuration
- [ ] Toggle auto-processing on
- [ ] Open settings popover
- [ ] Disable "Extract Insights"
- [ ] Upload new call
- [ ] Verify insights NOT extracted
- [ ] Re-enable "Extract Insights"
- [ ] Disable "Apply PROFITS Framework"
- [ ] Upload new call
- [ ] Verify PROFITS NOT applied
- [ ] Test all processing options individually

## Edge Function Testing

### extract-knowledge Function
- [ ] Call function with test transcript
- [ ] Verify response includes insights
- [ ] Check PROFITS framework in response
- [ ] Confirm sentiment analysis
- [ ] Verify action items extracted
- [ ] Check error handling for invalid input
- [ ] Test with various transcript lengths
- [ ] Verify database inserts work

### generate-content Function
- [ ] Call function with test insights
- [ ] Verify content generation works
- [ ] Test all content types
- [ ] Check tone variations
- [ ] Verify streaming response
- [ ] Test error handling
- [ ] Confirm database storage

## Database Testing

### Data Integrity
- [ ] Verify calls table has new columns
- [ ] Check insights table populated
- [ ] Confirm quotes table working
- [ ] Verify workspaces table functional
- [ ] Check workspace_members table
- [ ] Confirm workspace_calls junction table
- [ ] Verify generated_content table

### Row Level Security
- [ ] Create second test user
- [ ] Verify User A cannot see User B's calls
- [ ] Check User A cannot see User B's insights
- [ ] Confirm workspace sharing works
- [ ] Verify workspace members can access shared data
- [ ] Test permission levels

### Relationships
- [ ] Verify call-to-insights relationship
- [ ] Check workspace-to-calls relationship
- [ ] Confirm user-to-workspace relationship
- [ ] Test cascade deletes
- [ ] Verify foreign key constraints

## Performance Testing

### Load Testing
- [ ] Upload 10 calls simultaneously
- [ ] Process 50 calls in batch
- [ ] Load insights page with 100+ insights
- [ ] Test analytics with large dataset
- [ ] Verify pagination works
- [ ] Check virtual scrolling (if implemented)

### Response Times
- [ ] Measure page load times
- [ ] Check API response times
- [ ] Verify AI processing speed
- [ ] Test search performance
- [ ] Check filter performance

## Error Handling

### User Errors
- [ ] Try to upload invalid file format
- [ ] Submit empty forms
- [ ] Enter invalid data
- [ ] Test with no internet connection
- [ ] Verify error messages are clear

### System Errors
- [ ] Test with invalid API keys
- [ ] Simulate database connection failure
- [ ] Test with rate-limited API
- [ ] Verify graceful degradation
- [ ] Check error logging

## Security Testing

### Authentication
- [ ] Verify login required for protected routes
- [ ] Test logout functionality
- [ ] Check session persistence
- [ ] Verify password reset works
- [ ] Test OAuth providers (if enabled)

### Authorization
- [ ] Verify RLS policies enforced
- [ ] Test unauthorized access attempts
- [ ] Check API endpoint protection
- [ ] Verify edge function authentication

### Data Protection
- [ ] Check sensitive data encryption
- [ ] Verify API keys not exposed
- [ ] Test CORS configuration
- [ ] Check for XSS vulnerabilities
- [ ] Verify SQL injection protection

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Mobile responsive design

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Test keyboard shortcuts
- [ ] Verify focus indicators visible
- [ ] Check modal keyboard trapping

### Screen Readers
- [ ] Test with screen reader
- [ ] Verify ARIA labels present
- [ ] Check semantic HTML
- [ ] Test alt text on images

### Visual Accessibility
- [ ] Check color contrast ratios
- [ ] Test with high contrast mode
- [ ] Verify text scaling works
- [ ] Check focus indicators

## User Acceptance Testing

### Workflow Testing
- [ ] Complete end-to-end workflow: Upload → Process → Generate Content
- [ ] Test workspace organization workflow
- [ ] Verify analytics workflow
- [ ] Test collaboration workflow

### Usability Testing
- [ ] Is the interface intuitive?
- [ ] Are error messages helpful?
- [ ] Is the design visually appealing?
- [ ] Are workflows efficient?
- [ ] Is the AI processing transparent?

## Production Readiness

### Deployment
- [ ] Build passes without errors
- [ ] No console errors in production build
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] DNS configured (if applicable)
- [ ] SSL certificate installed

### Monitoring
- [ ] Error tracking configured (Sentry)
- [ ] Analytics tracking set up
- [ ] Performance monitoring enabled
- [ ] Logging configured

### Documentation
- [ ] README updated
- [ ] API documentation complete
- [ ] User guide available
- [ ] Deployment guide written
- [ ] Troubleshooting guide created

## Sign-Off

### Development Team
- [ ] All tests passed
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Known issues documented

### Product Owner
- [ ] Features meet requirements
- [ ] UI/UX approved
- [ ] Performance acceptable
- [ ] Ready for production

### QA Team
- [ ] All test cases passed
- [ ] No critical bugs
- [ ] Performance benchmarks met
- [ ] Security review complete

---

## Notes

Record any issues, observations, or recommendations during testing:

**Issues Found:**
1. 
2. 
3. 

**Performance Observations:**
1. 
2. 
3. 

**Recommendations:**
1. 
2. 
3. 

**Test Environment:**
- Date: 
- Tester: 
- Browser: 
- OS: 
- Database: 
- API Keys: 

**Overall Status:**
- [ ] Ready for Production
- [ ] Needs Minor Fixes
- [ ] Needs Major Fixes
- [ ] Not Ready
