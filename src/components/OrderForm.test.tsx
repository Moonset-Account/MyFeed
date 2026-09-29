// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OrderForm from './OrderForm';
import type { Product } from '../../shared/types';

const products: Product[] = [
  {
    id: 'croissant',
    name: '原味可颂',
    price: 12,
    unitsPerBatch: 12,
    recipe: [{ ingredientId: 'flour', amount: 55 }],
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OrderForm', () => {
  it('渲染商品列表并可提交订单', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'abc12345' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onCreated = vi.fn();

    render(<OrderForm products={products} defaultDate="2026-10-01" onCreated={onCreated} />);
    expect(screen.getByText(/原味可颂/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('姓名'), { target: { value: '张三' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: '提交预订' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      customerName: '张三',
      pickupDate: '2026-10-01',
      items: [{ productId: 'croissant', qty: 6 }],
    });
  });

  it('后端拒绝时展示错误信息', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: '原料不足', details: ['高筋面粉 不足'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OrderForm products={products} defaultDate="2026-10-01" onCreated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('姓名'), { target: { value: '李四' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '提交预订' }));

    expect(await screen.findByText('原料不足')).toBeInTheDocument();
    expect(await screen.findByText('高筋面粉 不足')).toBeInTheDocument();
  });
});
