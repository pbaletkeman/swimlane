/**
 * Form builder page for managing a facility's signup form questions and facility rules.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { facilities } from '../api/facilities.ts'
import { forms } from '../api/forms.ts'
import type { Facility, FacilityRule, FormQuestion, QuestionInput, RuleInput } from '../api/types.ts'
import { BulkDeleteBar } from '../components/BulkDeleteBar.tsx'
import { ConfirmDelete } from '../components/ConfirmDelete.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { EntityDataTable } from '../components/EntityDataTable.tsx'
import type { EntityDataTableColumn } from '../components/EntityDataTable.tsx'
import { EntityFormDialog } from '../components/EntityFormDialog.tsx'
import type { EntityFormField, EntityFormFieldOption } from '../components/EntityFormDialog.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { showToastError, showToastSuccess } from '../toast/toast-context.ts'

const QUESTION_TYPE_OPTIONS: EntityFormFieldOption[] = [
  { label: 'Text', value: 'text' },
  { label: 'Checkbox', value: 'checkbox' },
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

export default function FormBuilderPage() {
  const { facilityId } = useParams()
  const navigate = useNavigate()
  const id = Number(facilityId)

  const [facility, setFacility] = useState<Facility | null>(null)
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [rules, setRules] = useState<FacilityRule[]>([])
  const [loading, setLoading] = useState(true)

  const [questionDialogVisible, setQuestionDialogVisible] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null)
  const [submittingQuestion, setSubmittingQuestion] = useState(false)
  const [questionKeys, setQuestionKeys] = useState<Record<string, boolean>>({})

  const [ruleDialogVisible, setRuleDialogVisible] = useState(false)
  const [editingRule, setEditingRule] = useState<FacilityRule | null>(null)
  const [submittingRule, setSubmittingRule] = useState(false)
  const [ruleKeys, setRuleKeys] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [facilityData, formData] = await Promise.all([facilities.get(id), forms.getFacilityForm(id)])
      setFacility(facilityData)
      setQuestions(formData.questions)
      setRules(formData.rules)
      setQuestionKeys({})
      setRuleKeys({})
    } catch (error) {
      showToastError('Load failed', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (Number.isFinite(id) && id > 0) {
      void load()
    }
  }, [id, load])

  const openCreateQuestion = () => {
    setEditingQuestion(null)
    setQuestionDialogVisible(true)
  }

  const openEditQuestion = (row: FormQuestion) => {
    setEditingQuestion(row)
    setQuestionDialogVisible(true)
  }

  const handleSubmitQuestion = async (values: Record<string, unknown>) => {
    const input: QuestionInput = {
      facility_id: id,
      prompt: String(values.prompt ?? ''),
      question_type: values.question_type === 'checkbox' ? 'checkbox' : 'text',
      is_required: values.is_required === true,
      sort_order: typeof values.sort_order === 'number' ? values.sort_order : 0,
      is_active: values.is_active === true,
    }
    setSubmittingQuestion(true)
    try {
      if (editingQuestion) {
        await forms.updateQuestion(editingQuestion.form_question_id!, input)
        showToastSuccess('Question updated', `"${input.prompt}" was updated.`)
      } else {
        await forms.createQuestion(input)
        showToastSuccess('Question created', `"${input.prompt}" was created.`)
      }
      setQuestionDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmittingQuestion(false)
    }
  }

  const handleSoftDeleteQuestion = async (row: FormQuestion) => {
    try {
      await forms.deleteQuestion(row.form_question_id!)
      showToastSuccess('Question deleted', `"${row.prompt}" was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDeleteQuestion = async (row: FormQuestion) => {
    try {
      await forms.hardDeleteQuestion(row.form_question_id!)
      showToastSuccess('Question deleted', `"${row.prompt}" was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDeleteQuestions = async () => {
    const ids = questions
      .filter((row) => row.form_question_id !== undefined && questionKeys[String(row.form_question_id)] === true)
      .map((row) => row.form_question_id!)
    if (ids.length === 0) {
      return
    }
    try {
      await forms.deleteQuestionsBulk(ids)
      showToastSuccess('Questions deleted', `${ids.length} question(s) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  const openCreateRule = () => {
    setEditingRule(null)
    setRuleDialogVisible(true)
  }

  const openEditRule = (row: FacilityRule) => {
    setEditingRule(row)
    setRuleDialogVisible(true)
  }

  const handleSubmitRule = async (values: Record<string, unknown>) => {
    const input: RuleInput = {
      facility_id: id,
      title: String(values.title ?? ''),
      content: String(values.content ?? ''),
      sort_order: typeof values.sort_order === 'number' ? values.sort_order : 0,
      is_active: values.is_active === true,
    }
    setSubmittingRule(true)
    try {
      if (editingRule) {
        await forms.updateRule(editingRule.rule_id!, input)
        showToastSuccess('Rule updated', `"${input.title}" was updated.`)
      } else {
        await forms.createRule(input)
        showToastSuccess('Rule created', `"${input.title}" was created.`)
      }
      setRuleDialogVisible(false)
      await load()
    } catch (error) {
      showToastError('Save failed', errorMessage(error))
    } finally {
      setSubmittingRule(false)
    }
  }

  const handleSoftDeleteRule = async (row: FacilityRule) => {
    try {
      await forms.deleteRule(row.rule_id!)
      showToastSuccess('Rule deleted', `"${row.title}" was deactivated.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleHardDeleteRule = async (row: FacilityRule) => {
    try {
      await forms.hardDeleteRule(row.rule_id!)
      showToastSuccess('Rule deleted', `"${row.title}" was permanently deleted.`)
      await load()
    } catch (error) {
      showToastError('Delete failed', errorMessage(error))
    }
  }

  const handleBulkDeleteRules = async () => {
    const ids = rules
      .filter((row) => row.rule_id !== undefined && ruleKeys[String(row.rule_id)] === true)
      .map((row) => row.rule_id!)
    if (ids.length === 0) {
      return
    }
    try {
      await forms.deleteRulesBulk(ids)
      showToastSuccess('Rules deleted', `${ids.length} rule(s) deactivated.`)
      await load()
    } catch (error) {
      showToastError('Bulk delete failed', errorMessage(error))
    }
  }

  const questionColumns: EntityDataTableColumn<FormQuestion>[] = [
    { field: 'prompt', header: 'Prompt', sortable: true },
    {
      field: 'question_type',
      header: 'Type',
      body: (row) => (
        <Tag severity={row.question_type === 'checkbox' ? 'warn' : 'info'}>
          {row.question_type === 'checkbox' ? 'Checkbox' : 'Text'}
        </Tag>
      ),
    },
    {
      field: 'is_required',
      header: 'Required',
      body: (row) => (
        <Tag severity={row.is_required ? 'danger' : 'secondary'}>{row.is_required ? 'Required' : 'Optional'}</Tag>
      ),
    },
    { field: 'sort_order', header: 'Sort Order' },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const questionFields: EntityFormField<QuestionInput>[] = [
    {
      name: 'prompt',
      label: 'Prompt',
      type: 'text',
      required: true,
      placeholder: 'e.g., Emergency contact phone number',
    },
    { name: 'question_type', label: 'Type', type: 'select', required: true, options: QUESTION_TYPE_OPTIONS },
    { name: 'is_required', label: 'Required', type: 'checkbox' },
    { name: 'sort_order', label: 'Sort Order', type: 'number', min: 0 },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  const ruleColumns: EntityDataTableColumn<FacilityRule>[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'content', header: 'Content' },
    { field: 'sort_order', header: 'Sort Order' },
    {
      field: 'is_active',
      header: 'Active',
      body: (row) => (
        <Tag severity={row.is_active ? 'success' : 'secondary'}>{row.is_active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
  ]

  const ruleFields: EntityFormField<RuleInput>[] = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'content', label: 'Content', type: 'textarea', rows: 4, required: true },
    { name: 'sort_order', label: 'Sort Order', type: 'number', min: 0 },
    { name: 'is_active', label: 'Active', type: 'checkbox' },
  ]

  return (
    <div className="app-crud-page">
      <PageHeader
        title={facility?.name ?? 'Form Builder'}
        subtitle="Manage the signup form questions and facility rules."
      />
      <Button type="button" variant="text" onClick={() => navigate('/forms')} className="form-builder-back">
        <i className="pi pi-arrow-left" />
        <span className="p-button-label">Back to facilities</span>
      </Button>

      <section className="form-builder-section">
        <div className="form-builder-section-header">
          <h2 className="form-builder-section-title">Questions</h2>
          <Button type="button" onClick={openCreateQuestion}>
            <i className="pi pi-plus" />
            <span className="p-button-label">New Question</span>
          </Button>
        </div>
        {questions.length === 0 && !loading ? (
          <EmptyState
            message="No questions yet."
            hint="Add questions that members must answer when signing up."
            icon="pi-list-check"
            action={
              <Button type="button" onClick={openCreateQuestion}>
                <i className="pi pi-plus" />
                <span className="p-button-label">New Question</span>
              </Button>
            }
          />
        ) : (
          <>
            <BulkDeleteBar
              count={Object.values(questionKeys).filter(Boolean).length}
              itemLabel="question"
              onBulkDelete={handleBulkDeleteQuestions}
            />
            <EntityDataTable
              data={questions}
              columns={questionColumns}
              dataKey="form_question_id"
              loading={loading}
              searchableFields={['prompt']}
              searchPlaceholder="Search questions..."
              defaultSortField="sort_order"
              actionsHeader="Actions"
              selectable
              selectedKeys={questionKeys}
              onSelectionChange={setQuestionKeys}
              actions={(row) => (
                <div className="app-crud-row-actions">
                  <Button
                    type="button"
                    variant="text"
                    iconOnly
                    aria-label={`Edit ${row.prompt}`}
                    title={`Edit ${row.prompt}`}
                    onClick={() => openEditQuestion(row)}
                  >
                    <i className="pi pi-pencil" />
                  </Button>
                  <ConfirmDelete
                    itemName={row.prompt}
                    onSoftDelete={() => handleSoftDeleteQuestion(row)}
                    onHardDelete={() => handleHardDeleteQuestion(row)}
                  />
                </div>
              )}
            />
          </>
        )}
      </section>

      <section className="form-builder-section">
        <div className="form-builder-section-header">
          <h2 className="form-builder-section-title">Rules</h2>
          <Button type="button" onClick={openCreateRule}>
            <i className="pi pi-plus" />
            <span className="p-button-label">New Rule</span>
          </Button>
        </div>
        {rules.length === 0 && !loading ? (
          <EmptyState
            message="No rules yet."
            hint="Add rules members agree to when signing up."
            icon="pi-exclamation-circle"
            action={
              <Button type="button" onClick={openCreateRule}>
                <i className="pi pi-plus" />
                <span className="p-button-label">New Rule</span>
              </Button>
            }
          />
        ) : (
          <>
            <BulkDeleteBar
              count={Object.values(ruleKeys).filter(Boolean).length}
              itemLabel="rule"
              onBulkDelete={handleBulkDeleteRules}
            />
            <EntityDataTable
              data={rules}
              columns={ruleColumns}
              dataKey="rule_id"
              loading={loading}
              searchableFields={['title', 'content']}
              searchPlaceholder="Search rules..."
              defaultSortField="sort_order"
              actionsHeader="Actions"
              selectable
              selectedKeys={ruleKeys}
              onSelectionChange={setRuleKeys}
              actions={(row) => (
                <div className="app-crud-row-actions">
                  <Button
                    type="button"
                    variant="text"
                    iconOnly
                    aria-label={`Edit ${row.title}`}
                    title={`Edit ${row.title}`}
                    onClick={() => openEditRule(row)}
                  >
                    <i className="pi pi-pencil" />
                  </Button>
                  <ConfirmDelete
                    itemName={row.title}
                    onSoftDelete={() => handleSoftDeleteRule(row)}
                    onHardDelete={() => handleHardDeleteRule(row)}
                  />
                </div>
              )}
            />
          </>
        )}
      </section>

      <EntityFormDialog
        visible={questionDialogVisible}
        title={editingQuestion ? 'Edit Question' : 'New Question'}
        fields={questionFields}
        initialValues={
          editingQuestion
            ? {
                prompt: editingQuestion.prompt,
                question_type: editingQuestion.question_type,
                is_required: editingQuestion.is_required,
                sort_order: editingQuestion.sort_order,
                is_active: editingQuestion.is_active,
              }
            : { question_type: 'text', is_required: true, sort_order: 0, is_active: true }
        }
        onSubmit={handleSubmitQuestion}
        onHide={() => setQuestionDialogVisible(false)}
        submitting={submittingQuestion}
      />

      <EntityFormDialog
        visible={ruleDialogVisible}
        title={editingRule ? 'Edit Rule' : 'New Rule'}
        fields={ruleFields}
        initialValues={
          editingRule
            ? {
                title: editingRule.title,
                content: editingRule.content,
                sort_order: editingRule.sort_order,
                is_active: editingRule.is_active,
              }
            : { sort_order: 0, is_active: true }
        }
        onSubmit={handleSubmitRule}
        onHide={() => setRuleDialogVisible(false)}
        submitting={submittingRule}
      />
    </div>
  )
}