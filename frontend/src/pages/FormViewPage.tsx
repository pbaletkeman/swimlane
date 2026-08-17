import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Checkbox } from 'primereact/checkbox'
import { InputText } from 'primereact/inputtext'
import { facilities } from '../api/facilities.ts'
import { forms } from '../api/forms.ts'
import type { CheckboxRootChangeEvent } from '@primereact/types/primitive/checkbox'
import type { Facility, FacilityForm, FormQuestion, FormResponseInput } from '../api/types.ts'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'
import { ErrorPage } from './ErrorPage.tsx'

type Answers = Record<number, { answer_text?: string; answer_bool?: boolean }>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function FormViewPage() {
  const { facilityId } = useParams()
  const navigate = useNavigate()
  const id = Number(facilityId)

  const [facility, setFacility] = useState<Facility | null>(null)
  const [form, setForm] = useState<FacilityForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Answers>({})
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionId, setSubmissionId] = useState<number | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      return
    }
    setLoading(true)
    try {
      const [facilityData, formData] = await Promise.all([facilities.get(id), forms.getFacilityForm(id)])
      setFacility(facilityData)
      setForm(formData)
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const submitted = submissionId !== null

  const errors = useMemo<Record<number, string>>(() => {
    const result: Record<number, string> = {}
    if (!form) {
      return result
    }
    for (const question of form.questions) {
      if (!question.is_required || question.form_question_id === undefined) {
        continue
      }
      const answer = answers[question.form_question_id]
      if (question.question_type === 'checkbox') {
        if (answer?.answer_bool !== true) {
          result[question.form_question_id] = 'This question must be checked.'
        }
      } else if (!(answer?.answer_text ?? '').trim()) {
        result[question.form_question_id] = 'This question is required.'
      }
    }
    return result
  }, [form, answers])

  const hasErrors = Object.keys(errors).length > 0
  const canSubmit = form !== null && form.questions.length > 0 && consented && !hasErrors && !submitting && !submitted

  const setText = (questionId: number, value: string) =>
    setAnswers((previous) => ({ ...previous, [questionId]: { ...previous[questionId], answer_text: value } }))

  const setBool = (questionId: number, checked: boolean) =>
    setAnswers((previous) => ({ ...previous, [questionId]: { ...previous[questionId], answer_bool: checked } }))

  const handleSubmit = async () => {
    if (!form || !canSubmit) {
      return
    }
    setSubmitting(true)
    try {
      const responses: FormResponseInput[] = []
      for (const question of form.questions) {
        if (question.form_question_id === undefined) {
          continue
        }
        const answer = answers[question.form_question_id]
        if (question.question_type === 'checkbox') {
          responses.push({ question_id: question.form_question_id, answer_bool: answer?.answer_bool === true })
        } else {
          responses.push({ question_id: question.form_question_id, answer_text: answer?.answer_text ?? '' })
        }
      }
      const created = await forms.submitForm(id, { signed: true, responses })
      setSubmissionId(created.submission_id ?? null)
      setConsented(false)
      showToastSuccess('Form submitted', `Your signup form for ${facility?.name ?? 'the facility'} was submitted.`)
    } catch (error) {
      showToastError('Submit failed', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (submissionId === null) {
      return
    }
    setDownloadingPdf(true)
    try {
      const blob = await forms.getSubmissionPdf(submissionId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `submission-${submissionId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      showToastError('Download failed', errorMessage(error))
    } finally {
      setDownloadingPdf(false)
    }
  }

  const renderQuestion = (question: FormQuestion): ReactNode => {
    const questionId = question.form_question_id
    if (questionId === undefined) {
      return null
    }
    const answer = answers[questionId]
    const requiredLabel = question.is_required ? (
      <span className="form-required" aria-hidden="true">
        *
      </span>
    ) : null
    const error = errors[questionId]

    if (question.question_type === 'checkbox') {
      return (
        <div key={questionId} className="form-question">
          <label className="form-question-label">
            {question.prompt}
            {requiredLabel}
          </label>
          <Checkbox.Root
            checked={answer?.answer_bool === true}
            invalid={error !== undefined}
            aria-label={question.prompt}
            aria-required={question.is_required}
            disabled={submitted}
            onCheckedChange={(event: CheckboxRootChangeEvent) => setBool(questionId, event.checked)}
          />
          {error !== undefined && <small className="form-question-error">{error}</small>}
        </div>
      )
    }

    return (
      <div key={questionId} className="form-question">
        <label className="form-question-label" htmlFor={`question-${questionId}`}>
          {question.prompt}
          {requiredLabel}
        </label>
        <InputText
          id={`question-${questionId}`}
          value={answer?.answer_text ?? ''}
          invalid={error !== undefined}
          placeholder="Your answer"
          disabled={submitted}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setText(questionId, event.target.value)}
        />
        {error !== undefined && <small className="form-question-error">{error}</small>}
      </div>
    )
  }

  return (
    <div className="app-crud-page">
      <PageHeader title={facility?.name ?? 'Signup Form'} subtitle="Complete the form below to sign up." />
      {loading ? (
        <div className="app-page-loading">
          <i className="pi pi-spin pi-spinner" />
        </div>
      ) : form === null ? (
        <ErrorPage
          title="Form not found"
          message="The requested facility signup form could not be loaded."
          actionLabel="Back to facilities"
          onAction={() => navigate('/forms')}
        />
      ) : form.questions.length === 0 && form.rules.length === 0 ? (
        <div className="app-page-not-found">
          <h1>No signup form yet</h1>
          <p>This facility has not published a signup form.</p>
          <Button type="button" variant="outlined" onClick={() => navigate('/forms')}>
            <i className="pi pi-arrow-left" />
            <span className="p-button-label">Back to facilities</span>
          </Button>
        </div>
      ) : (
        <Card.Root className="form-card">
          <Card.Header>
            <Card.Title>Facility Signup Form</Card.Title>
          </Card.Header>
          <Card.Content className="form-card-content">
            {submitted && (
              <div className="form-submitted-banner">
                <i className="pi pi-check-circle" />
                <div>
                  <strong>Form submitted.</strong> Your responses have been recorded{facility ? ` for ${facility.name}` : ''}.
                </div>
              </div>
            )}
            <div className="form-questions">
              {form.questions.map((question) => renderQuestion(question))}
            </div>
            {form.rules.length > 0 && (
              <section className="form-rules" aria-label="Facility rules">
                <h2 className="form-rules-title">Facility Rules</h2>
                <ul className="form-rules-list">
                  {form.rules.map((rule) => (
                    <li key={rule.rule_id} className="form-rule">
                      <i className="pi pi-exclamation-circle" aria-hidden="true" />
                      <div className="form-rule-body">
                        {rule.title && <strong className="form-rule-title">{rule.title}</strong>}
                        <span>{rule.content}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="form-consent">
              <Checkbox.Root
                checked={consented}
                disabled={submitted}
                aria-label="I agree to the facility rules and consent to this signup"
                onCheckedChange={(event: CheckboxRootChangeEvent) => setConsented(event.checked)}
              />
              <label className="form-consent-label">
                I agree to the facility rules and consent to this signup.
                <span className="form-required" aria-hidden="true">
                  *
                </span>
              </label>
            </div>
            <div className="form-actions">
              <Button type="button" severity="success" loading={submitting} disabled={!canSubmit} onClick={() => void handleSubmit()}>
                <i className="pi pi-pencil" />
                <span className="p-button-label">Submit Signup Form</span>
              </Button>
              {submissionId !== null && (
                <Button type="button" variant="outlined" loading={downloadingPdf} onClick={() => void handleDownloadPdf()}>
                  <i className="pi pi-file-pdf" />
                  <span className="p-button-label">Download PDF</span>
                </Button>
              )}
            </div>
            {!consented && !submitted && (
              <p className="form-consent-hint">Check the consent box to submit.</p>
            )}
            {hasErrors && !submitted && (
              <p className="form-consent-hint">Answer all required questions to submit.</p>
            )}
          </Card.Content>
        </Card.Root>
      )}
    </div>
  )
}