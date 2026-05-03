import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/receipt'
import { useAuth } from '../state/AuthContext'
import { Roles } from '../types/auth'
import type { Category, Product, ProductUnit } from '../types/entities'

const productUnitOptions = [
  'pcs',
  'sheet',
  'plate',
  'pipe',
  'tube',
  'bar',
  'kg',
  'meter',
  'roll',
  'set',
  'box',
]

type StockAdjustmentMode = 'increase' | 'decrease' | 'set'

export function ProductsPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const [searchParams] = useSearchParams()
  const isCreatingFromStockIn = searchParams.get('create') === '1' && searchParams.get('from') === 'stock-in'
  const {
    data: products,
    isLoading,
    error,
    refetch: refetchProducts,
  } = useApiData<Product[]>('/products', [])
  const { data: categories, refetch: refetchCategories } = useApiData<Category[]>(
    '/categories',
    [],
  )
  const { data: productUnits, refetch: refetchUnits } = useApiData<ProductUnit[]>('/product-units', [])
  const mutation = useApiMutation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [categoryForm, setCategoryForm] = usePersistentState('products-category-form', { name: '', description: '' })
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryEditForm, setCategoryEditForm] = useState({
    name: '',
    description: '',
    isActive: true,
  })
  const [productForm, setProductForm] = usePersistentState('products-product-form', {
    sku: '',
    name: '',
    description: '',
    costPrice: '0',
    price: '0',
    unit: 'pcs',
    categoryId: '0',
    initialQuantity: '0',
    reorderLevel: '0',
    location: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    costPrice: '0',
    price: '0',
    unit: 'pcs',
    categoryId: '0',
    isActive: true,
  })
  const [stockAdjustmentForm, setStockAdjustmentForm] = usePersistentState('products-stock-adjustment-form', {
    adjustmentMode: 'increase' as StockAdjustmentMode,
    quantity: '0',
    remarks: '',
  })
  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...productUnitOptions,
          ...productUnits.map((unit) => unit.name).filter(Boolean),
          ...products.map((product) => product.unit).filter(Boolean),
        ]),
      ),
    [productUnits, products],
  )

  useEffect(() => {
    if (!isCreatingFromStockIn) {
      return
    }

    window.setTimeout(() => {
      document.getElementById('create-product-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }, [isCreatingFromStockIn])

  const addSavedUnit = async (value: string) => {
    const unit = value.trim().toLowerCase()
    if (!unit || unitOptions.includes(unit)) {
      return
    }

    const created = await mutation.run(
      () => api.post('/product-units', { name: unit }),
      'Unit added.',
    )
    if (created) {
      await refetchUnits()
    }
  }

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === editingId) ?? null,
    [editingId, products],
  )
  const parsedStockAdjustmentQuantity = Number(stockAdjustmentForm.quantity)
  const stockAdjustmentQuantity = Number.isFinite(parsedStockAdjustmentQuantity)
    ? parsedStockAdjustmentQuantity
    : 0
  const isValidStockAdjustmentQuantity =
    stockAdjustmentForm.adjustmentMode === 'set'
      ? stockAdjustmentQuantity >= 0
      : stockAdjustmentQuantity > 0
  const previewStockQuantityChange = selectedProduct
    ? stockAdjustmentForm.adjustmentMode === 'set'
      ? stockAdjustmentQuantity - selectedProduct.quantityOnHand
      : stockAdjustmentForm.adjustmentMode === 'decrease'
        ? -Math.abs(stockAdjustmentQuantity)
        : Math.abs(stockAdjustmentQuantity)
    : 0

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.categoryName.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && product.isActive) ||
        (statusFilter === 'Inactive' && !product.isActive)

      const matchesCategory =
        categoryFilter === 'All' || product.categoryName === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [categoryFilter, products, search, statusFilter])
  const productSummary = useMemo(() => {
    const activeCount = filteredProducts.filter((product) => product.isActive).length
    const inactiveCount = filteredProducts.length - activeCount
    const totalUnits = filteredProducts.reduce((sum, product) => sum + product.quantityOnHand, 0)
    const totalInventoryValue = filteredProducts.reduce(
      (sum, product) => sum + product.quantityOnHand * product.costPrice,
      0,
    )

    return { activeCount, inactiveCount, totalUnits, totalInventoryValue }
  }, [filteredProducts])

  return (
    <PageFrame
      title="Products"
      description="Live product catalog backed by the API, with owner-only control over product code, cost price, selling price, and reorder levels."
      aside={<div className="badge">Owner Only</div>}
    >
      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}
      {mutation.success ? <div className="subtle-panel">{mutation.success}</div> : null}

      <div className="stats-grid compact-stats">
        <div className="stat-card">
          <span>Visible Products</span>
          <strong>{filteredProducts.length}</strong>
        </div>
        <div className="stat-card">
          <span>Active</span>
          <strong>{productSummary.activeCount}</strong>
        </div>
        <div className="stat-card">
          <span>Units on Hand</span>
          <strong>{productSummary.totalUnits}</strong>
        </div>
        {isSuperAdmin ? (
        <div className="stat-card">
          <span>Inventory Value</span>
          <strong>{formatCurrency(productSummary.totalInventoryValue)}</strong>
        </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="inventory-toolbar inventory-toolbar-primary">
          <label className="field search-field">
            <span>Search Products</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name, barcode/code, or category"
            />
          </label>
          <div className="inventory-toolbar-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('All')
                setCategoryFilter('All')
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="inventory-toolbar">
          <label className="field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'All' | 'Active' | 'Inactive')
              }
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="All">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="subtle-panel panel-note">{filteredProducts.length} visible products</div>
          <div className="summary-block compact-summary">
            <strong>Inactive products</strong>
            <span>{productSummary.inactiveCount} product(s) currently hidden from POS sales.</span>
          </div>
        </div>
      </div>

      {isSuperAdmin ? (
        <div className="two-column">
          <section className="panel">
            <div className="split-line">
              <h4>{editingCategoryId ? 'Edit Category' : 'Create Category'}</h4>
              {editingCategoryId ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setEditingCategoryId(null)
                    setCategoryEditForm({ name: '', description: '', isActive: true })
                  }}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
            <div className="stack-form">
              <label className="field">
                <span>Name</span>
                <input
                  value={editingCategoryId ? categoryEditForm.name : categoryForm.name}
                  onChange={(event) =>
                    editingCategoryId
                      ? setCategoryEditForm((current) => ({ ...current, name: event.target.value }))
                      : setCategoryForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Description</span>
                <input
                  value={editingCategoryId ? categoryEditForm.description : categoryForm.description}
                  onChange={(event) =>
                    editingCategoryId
                      ? setCategoryEditForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      : setCategoryForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                  }
                />
              </label>
              {editingCategoryId ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={categoryEditForm.isActive}
                    onChange={(event) =>
                      setCategoryEditForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  <span>Active category</span>
                </label>
              ) : null}
              <button
                className="primary-button"
                type="button"
                disabled={mutation.isSubmitting}
                onClick={async () => {
                  const saved = editingCategoryId
                    ? await mutation.run(
                        () => api.put(`/categories/${editingCategoryId}`, categoryEditForm),
                        'Category updated.',
                      )
                    : await mutation.run(
                        () => api.post('/categories', categoryForm),
                        'Category created.',
                      )
                  if (saved) {
                    setCategoryForm({ name: '', description: '' })
                    setEditingCategoryId(null)
                    setCategoryEditForm({ name: '', description: '', isActive: true })
                    await refetchCategories()
                    await refetchProducts()
                  }
                }}
              >
                {editingCategoryId ? 'Save Category' : 'Create Category'}
              </button>
              {categories.length > 0 ? (
                <div className="category-edit-list">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      className="category-edit-row"
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(category.id)
                        setCategoryEditForm({
                          name: category.name,
                          description: category.description,
                          isActive: category.isActive,
                        })
                      }}
                    >
                      <span>
                        <strong>{category.name}</strong>
                        <small>{category.description || 'No description'}</small>
                      </span>
                      <em>{category.isActive ? 'Active' : 'Inactive'}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section
            className={isCreatingFromStockIn ? 'panel product-create-panel highlighted-create-panel' : 'panel product-create-panel'}
            id="create-product-section"
          >
            <div className="split-line">
              <div>
                <h4>Create Product</h4>
                {isCreatingFromStockIn ? (
                  <span className="muted">
                    Add the new delivered item here first, then return to Stock Receiving.
                  </span>
                ) : null}
              </div>
              {isCreatingFromStockIn ? (
                <Link className="ghost-button" to="/stock-in">
                  Back to Stock Receiving
                </Link>
              ) : null}
            </div>
            {isCreatingFromStockIn ? (
              <div className="subtle-panel">
                New product flow: create the product with category, unit, price, and starting
                quantity. After saving, go back to Stock Receiving and select it in the product list.
              </div>
            ) : null}
            <div className="stack-form">
              <label className="field">
                <span>Barcode / Product Code</span>
                <input
                  value={productForm.sku}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, sku: event.target.value }))
                  }
                  placeholder="Scan barcode or type product code"
                />
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Description</span>
                <input
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="mini-grid">
                <label className="field">
                  <span>Cost Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.costPrice}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, costPrice: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Selling Price</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, price: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Unit</span>
                <input
                  value={productForm.unit}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, unit: event.target.value }))
                  }
                  placeholder="Type unit, e.g. pcs or meter"
                />
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void addSavedUnit(productForm.unit)}
              >
                Add Unit
              </button>
              <div className="unit-chip-row">
                {unitOptions.slice(0, 12).map((unit) => (
                  <button
                    key={unit}
                    className={productForm.unit === unit ? 'unit-chip active' : 'unit-chip'}
                    type="button"
                    onClick={() => setProductForm((current) => ({ ...current, unit }))}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Category</span>
                <select
                  value={productForm.categoryId}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                >
                  <option value="0">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mini-grid">
                <label className="field">
                  <span>Initial Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.initialQuantity}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        initialQuantity: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Reorder Level</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.reorderLevel}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        reorderLevel: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Location</span>
                <input
                  value={productForm.location}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={mutation.isSubmitting}
                onClick={async () => {
                  const created = await mutation.run(
                    () =>
                      api.post('/products', {
                        ...productForm,
                        costPrice: Number(productForm.costPrice),
                        price: Number(productForm.price),
                        categoryId: Number(productForm.categoryId),
                        initialQuantity: Number(productForm.initialQuantity),
                        reorderLevel: Number(productForm.reorderLevel),
                      }),
                    'Product created.',
                  )
                  if (created) {
                    await addSavedUnit(productForm.unit)
                    setProductForm({
                      sku: '',
                      name: '',
                      description: '',
                      costPrice: '0',
                      price: '0',
                      unit: 'pcs',
                      categoryId: '0',
                      initialQuantity: '0',
                      reorderLevel: '0',
                      location: '',
                    })
                    await refetchProducts()
                  }
                }}
              >
                Create Product
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No products found."
        hasData={filteredProducts.length > 0}
      />

      {selectedProduct && isSuperAdmin ? (
        <div className="panel stack-form">
          <div className="split-line">
            <h4>Update {selectedProduct.name}</h4>
            <button className="ghost-button" type="button" onClick={() => setEditingId(null)}>
              Close
            </button>
          </div>
          <div className="mini-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Cost Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.costPrice}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, costPrice: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="mini-grid">
            <label className="field">
              <span>Selling Price</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={editForm.price}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, price: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Unit</span>
              <input
                value={editForm.unit}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="Type unit, e.g. pcs or meter"
              />
            </label>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void addSavedUnit(editForm.unit)}
            >
              Add Unit
            </button>
            <div className="unit-chip-row">
              {unitOptions.slice(0, 12).map((unit) => (
                <button
                  key={unit}
                  className={editForm.unit === unit ? 'unit-chip active' : 'unit-chip'}
                  type="button"
                  onClick={() => setEditForm((current) => ({ ...current, unit }))}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Category</span>
            <select
              value={editForm.categoryId}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Description</span>
            <input
              value={editForm.description}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            <span>Active product</span>
          </label>

          <div className="panel nested-panel stack-form">
            <div className="split-line">
              <h4>Stock Adjustment</h4>
              <span className="badge">{selectedProduct.quantityOnHand} on hand</span>
            </div>
            <div className="product-stock-strip">
              <div>
                <span>Current Stock</span>
                <strong>{selectedProduct.quantityOnHand}</strong>
              </div>
              <div>
                <span>Reorder Level</span>
                <strong>{selectedProduct.reorderLevel}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{selectedProduct.location || 'Main rack'}</strong>
              </div>
            </div>
            <div className="stock-adjustment-control">
              <div className="action-row">
                <button
                  className={
                    stockAdjustmentForm.adjustmentMode === 'increase'
                      ? 'primary-button'
                      : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setStockAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'increase',
                    }))
                  }
                >
                  Add Stock
                </button>
                <button
                  className={
                    stockAdjustmentForm.adjustmentMode === 'decrease'
                      ? 'danger-button'
                      : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setStockAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'decrease',
                    }))
                  }
                >
                  Remove Stock
                </button>
                <button
                  className={
                    stockAdjustmentForm.adjustmentMode === 'set'
                      ? 'primary-button'
                      : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setStockAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'set',
                      quantity: String(selectedProduct.quantityOnHand),
                    }))
                  }
                >
                  Set Actual Count
                </button>
              </div>
              <label className="field">
                <span>
                  {stockAdjustmentForm.adjustmentMode === 'set'
                    ? 'Actual Count'
                    : 'Quantity Change'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockAdjustmentForm.quantity}
                  onChange={(event) =>
                    setStockAdjustmentForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="summary-block">
                <strong>Adjustment Preview</strong>
                <span>
                  New stock:{' '}
                  {stockAdjustmentForm.adjustmentMode === 'set'
                    ? Math.max(0, stockAdjustmentQuantity)
                    : selectedProduct.quantityOnHand + previewStockQuantityChange}
                </span>
                <span>Movement change: {previewStockQuantityChange}</span>
              </div>
              <label className="field">
                <span>Reason</span>
                <input
                  value={stockAdjustmentForm.remarks}
                  onChange={(event) =>
                    setStockAdjustmentForm((current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button
              className="ghost-button"
              type="button"
              disabled={
                mutation.isSubmitting ||
                !isValidStockAdjustmentQuantity ||
                previewStockQuantityChange === 0 ||
                selectedProduct.quantityOnHand + previewStockQuantityChange < 0 ||
                !stockAdjustmentForm.remarks.trim()
              }
              onClick={async () => {
                const quantityChange = previewStockQuantityChange
                const adjusted = await mutation.run(
                  () =>
                    api.post('/inventory/adjust', {
                      productId: selectedProduct.id,
                      quantityChange,
                      remarks: stockAdjustmentForm.remarks.trim(),
                    }),
                  'Stock adjusted.',
                )

                if (adjusted) {
                  setStockAdjustmentForm({
                    adjustmentMode: 'increase',
                    quantity: '0',
                    remarks: '',
                  })
                  await refetchProducts()
                }
              }}
            >
              Apply Stock Adjustment
            </button>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={mutation.isSubmitting}
            onClick={async () => {
              const updated = await mutation.run(
                () =>
                  api.put(`/products/${selectedProduct.id}`, {
                    ...editForm,
                    costPrice: Number(editForm.costPrice),
                    price: Number(editForm.price),
                    categoryId: Number(editForm.categoryId),
                  }),
                'Product updated.',
              )
              if (updated) {
                await addSavedUnit(editForm.unit)
                setEditingId(null)
                setStockAdjustmentForm({
                  adjustmentMode: 'increase',
                  quantity: '0',
                  remarks: '',
                })
                await refetchProducts()
              }
            }}
          >
            Save Product
          </button>
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                {isSuperAdmin ? <th>Cost Price</th> : null}
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Status</th>
                {isSuperAdmin ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-title-cell">
                      <strong>{product.name}</strong>
                      <span>Barcode / Product Code: {product.sku}</span>
                    </div>
                  </td>
                  <td>{product.categoryName}</td>
                  {isSuperAdmin ? <td>{formatCurrency(product.costPrice)}</td> : null}
                  <td>{formatCurrency(product.price)}</td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{product.quantityOnHand}</strong>
                      <span>{product.unit}</span>
                    </div>
                  </td>
                  <td>
                    <span className={product.isActive ? 'status-badge in' : 'status-badge out'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isSuperAdmin ? (
                    <td>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingId(product.id)
                          setStockAdjustmentForm({
                            adjustmentMode: 'increase',
                            quantity: '0',
                            remarks: '',
                          })
                          setEditForm({
                            name: product.name,
                            description: product.description,
                            costPrice: String(product.costPrice),
                            price: String(product.price),
                            unit: product.unit,
                            categoryId: String(
                              categories.find((item) => item.name === product.categoryName)?.id ?? 0,
                            ),
                            isActive: product.isActive,
                          })
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  )
}
