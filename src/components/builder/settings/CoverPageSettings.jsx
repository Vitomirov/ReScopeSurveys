import { useRef } from 'react'
import { Image as ImageIcon, X, Upload } from 'lucide-react'
import { Toggle } from '@/components/ui'
import { DEFAULT_SCREEN_MESSAGES, DEFAULT_START_BUTTON_TEXT } from '@/constants/survey/surveyDefaults'

const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB sanity cap for base64 storage

export function CoverPageSettings({ survey, dispatch }) {
  const fileInputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image is too large. Please use an image under 4MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      dispatch({ type: 'SET_SURVEY_FIELD', field: 'coverImage', value: reader.result })
    }
    reader.readAsDataURL(file)
  }

  const onInputChange = (e) => handleFile(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  const removeImage = () =>
    dispatch({ type: 'SET_SURVEY_FIELD', field: 'coverImage', value: null })

  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon size={12} /> Cover page
        </p>
        <Toggle
          size="sm"
          checked={survey.showCoverPage !== false}
          onChange={val => dispatch({ type: 'SET_SURVEY_FIELD', field: 'showCoverPage', value: val })}
          label={survey.showCoverPage !== false ? 'Shown to respondents' : 'Hidden — survey starts on Q1'}
        />
      </div>

      {survey.showCoverPage !== false && (
        <div className="space-y-3">
          {/* Image upload / preview */}
          {survey.coverImage ? (
            <div className="relative group rounded-xl overflow-hidden border border-ink-200">
              <img
                src={survey.coverImage}
                alt="Cover"
                className="w-full max-h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium bg-white text-ink-700 px-3 py-1.5 rounded-lg hover:bg-ink-50 transition-all"
                >
                  Replace
                </button>
                <button
                  onClick={removeImage}
                  className="text-xs font-medium bg-white text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-all flex items-center gap-1"
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-1.5 py-6 border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 rounded-xl cursor-pointer transition-all"
            >
              <Upload size={18} className="text-ink-300" />
              <p className="text-xs text-ink-500 font-medium">Click or drag an image here</p>
              <p className="text-xs text-ink-300">PNG, JPG up to 4MB</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onInputChange}
            className="hidden"
          />

          <p className="text-xs text-ink-400">
            Respondents will see your survey title, description, and this image before Q1. Use Preview to check how it looks.
          </p>
        </div>
      )}

      <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Start button text</label>
          <input
            type="text"
            value={survey.startButtonText || ''}
            onChange={e => dispatch({ type: 'SET_SURVEY_FIELD', field: 'startButtonText', value: e.target.value })}
            placeholder={DEFAULT_START_BUTTON_TEXT}
            className="input-base text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Completion page heading</label>
          <input
            type="text"
            value={survey.settings?.completeTitle || ''}
            onChange={e => dispatch({ type: 'SET_SURVEY_SETTING', key: 'completeTitle', value: e.target.value })}
            placeholder={DEFAULT_SCREEN_MESSAGES.completeTitle}
            className="input-base text-sm"
          />
        </div>
      </div>
    </div>
  )
}
