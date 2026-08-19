import api from './client.ts'
import type {
  FacilityForm,
  FacilityRule,
  FormQuestion,
  FormSubmission,
  FormSubmissionInput,
  MessageResponse,
  MySubmission,
  QuestionInput,
  RuleInput,
  SubmissionDetail,
} from './types.ts'

/**
 * Form endpoint wrappers (`/forms`): facility signup forms, submission, PDF
 * export, and question/rule management.
 */
export const forms = {
  getFacilityForm: (facilityId: number): Promise<FacilityForm> =>
    api.get<FacilityForm>(`/forms/${facilityId}`),
  submitForm: (facilityId: number, body: FormSubmissionInput): Promise<FormSubmission> =>
    api.post<FormSubmission>(`/forms/${facilityId}/submit`, body),
  getSubmissionPdf: (submissionId: number): Promise<Blob> =>
    api.get<Blob>(`/forms/submissions/${submissionId}/pdf`, { responseType: 'blob' }),
  listMySubmissions: (): Promise<MySubmission[]> =>
    api.get<MySubmission[]>('/forms/me/submissions'),
  getSubmission: (submissionId: number): Promise<SubmissionDetail> =>
    api.get<SubmissionDetail>(`/forms/submissions/${submissionId}`),

  createQuestion: (body: QuestionInput): Promise<FormQuestion> =>
    api.post<FormQuestion>('/forms/questions', body),
  updateQuestion: (questionId: number, body: QuestionInput): Promise<FormQuestion> =>
    api.put<FormQuestion>(`/forms/questions/${questionId}`, body),
  deleteQuestion: (questionId: number): Promise<MessageResponse> =>
    api.delete<MessageResponse>(`/forms/questions/${questionId}`),
  hardDeleteQuestion: (questionId: number): Promise<MessageResponse> =>
    api.delete<MessageResponse>(`/forms/questions/${questionId}/hard`),
  createQuestionsBulk: (bodies: QuestionInput[]): Promise<FormQuestion[]> =>
    api.post<FormQuestion[]>('/forms/questions/bulk', bodies),
  deleteQuestionsBulk: (ids: number[]): Promise<MessageResponse> =>
    api.delete<MessageResponse>(
      '/forms/questions/bulk',
      ids.map((form_question_id) => ({ form_question_id })),
    ),
  hardDeleteQuestionsBulk: (ids: number[]): Promise<MessageResponse> =>
    api.delete<MessageResponse>(
      '/forms/questions/bulk/hard',
      ids.map((form_question_id) => ({ form_question_id })),
    ),

  createRule: (body: RuleInput): Promise<FacilityRule> =>
    api.post<FacilityRule>('/forms/rules', body),
  updateRule: (ruleId: number, body: RuleInput): Promise<FacilityRule> =>
    api.put<FacilityRule>(`/forms/rules/${ruleId}`, body),
  deleteRule: (ruleId: number): Promise<MessageResponse> =>
    api.delete<MessageResponse>(`/forms/rules/${ruleId}`),
  hardDeleteRule: (ruleId: number): Promise<MessageResponse> =>
    api.delete<MessageResponse>(`/forms/rules/${ruleId}/hard`),
  createRulesBulk: (bodies: RuleInput[]): Promise<FacilityRule[]> =>
    api.post<FacilityRule[]>('/forms/rules/bulk', bodies),
  deleteRulesBulk: (ids: number[]): Promise<MessageResponse> =>
    api.delete<MessageResponse>('/forms/rules/bulk', ids.map((rule_id) => ({ rule_id }))),
  hardDeleteRulesBulk: (ids: number[]): Promise<MessageResponse> =>
    api.delete<MessageResponse>(
      '/forms/rules/bulk/hard',
      ids.map((rule_id) => ({ rule_id })),
    ),
}

export default forms