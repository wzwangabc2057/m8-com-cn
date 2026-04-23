import { getStoreConfigContext } from './config';
import { resolveStoreMessages } from './i18n';
import { getMedusaClient } from './medusa';
import { getPricingContext } from './pricing-context';
import { getEnv } from './cloudflare';

export interface CheckoutCartItemInput {
  variantId: string;
  quantity: number;
}

export interface CheckoutSummary {
  currencyCode?: string;
  subtotal: number;
  shippingTotal: number;
  total: number;
  shippingOptionId?: string;
  shippingOptionName?: string;
  paymentProviderId?: string;
}

export interface CheckoutPreparationResult {
  medusaCartId: string;
  summary: CheckoutSummary;
  selectedProviderId?: string;
}

export interface CheckoutCustomerInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  note?: string;
}

function splitName(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    return { first_name: '', last_name: '' };
  }

  const parts = normalized.split(/\s+/);
  return {
    first_name: parts[0] || normalized,
    last_name: parts.slice(1).join(' '),
  };
}

function toSummary(cart: any, shippingOptionName?: string, paymentProviderId?: string): CheckoutSummary {
  return {
    currencyCode: cart.currency_code,
    subtotal: cart.item_subtotal ?? cart.subtotal ?? 0,
    shippingTotal: cart.shipping_total ?? 0,
    total: cart.total ?? 0,
    shippingOptionId: cart.shipping_methods?.[0]?.shipping_option_id,
    shippingOptionName,
    paymentProviderId,
  };
}

export async function prepareCheckoutCart(
  cartItems: CheckoutCartItemInput[],
  customer?: CheckoutCustomerInput,
): Promise<CheckoutPreparationResult | { error: string; code: string }> {
  const env = getEnv();
  const { config: storeConfig, language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);
  const medusa = getMedusaClient(env.MEDUSA_BACKEND_URL, storeConfig.medusaPublishableKey);
  const pricingContext = await getPricingContext(env, medusa, language);

  if (!cartItems.length) {
    return { error: messages.emptyCheckoutCart, code: 'EMPTY_CART' };
  }

  const { first_name, last_name } = splitName(customer?.name || '');
  const countryCode = pricingContext.countryCode || 'th';

  const { cart } = await medusa.store.cart.create({
    region_id: pricingContext.regionId,
    sales_channel_id: storeConfig.medusaSalesChannelId,
    email: customer?.email,
    shipping_address: customer
      ? {
          first_name,
          last_name,
          phone: customer.phone,
          address_1: customer.address,
          city: customer.city,
          country_code: countryCode,
        }
      : {
          country_code: countryCode,
          city: 'Bangkok',
        },
    billing_address: customer
      ? {
          first_name,
          last_name,
          phone: customer.phone,
          address_1: customer.address,
          city: customer.city,
          country_code: countryCode,
        }
      : {
          country_code: countryCode,
          city: 'Bangkok',
        },
    metadata: customer?.note ? { note: customer.note } : undefined,
  } as any);

  for (const item of cartItems) {
    await medusa.store.cart.createLineItem(cart.id, {
      variant_id: item.variantId,
      quantity: item.quantity,
    });
  }

  const { shipping_options } = await medusa.store.fulfillment.listCartOptions({
    cart_id: cart.id,
  } as any);

  if (!shipping_options?.length) {
    return { error: messages.noShippingOption, code: 'NO_SHIPPING_OPTION' };
  }

  const selectedShipping = shipping_options[0];
  const { cart: cartWithShipping } = await medusa.store.cart.addShippingMethod(cart.id, {
    option_id: selectedShipping.id,
  } as any);

  const { payment_providers } = await medusa.store.payment.listPaymentProviders({
    region_id: cartWithShipping.region_id,
  } as any);

  const selectedProvider =
    payment_providers?.find((provider: { id: string }) => provider.id === 'pp_system_default') ||
    payment_providers?.[0];

  if (!selectedProvider) {
    return { error: messages.noPaymentProvider, code: 'NO_PAYMENT_PROVIDER' };
  }

  return {
    medusaCartId: cart.id,
    selectedProviderId: selectedProvider.id,
    summary: toSummary(cartWithShipping, selectedShipping.name, selectedProvider.id),
  };
}

export async function completeCheckoutCart(
  cartItems: CheckoutCartItemInput[],
  customer: CheckoutCustomerInput,
) {
  const prepared = await prepareCheckoutCart(cartItems, customer);
  if ('error' in prepared) {
    return prepared;
  }

  const env = getEnv();
  const { config: storeConfig } = await getStoreConfigContext();
  const medusa = getMedusaClient(env.MEDUSA_BACKEND_URL, storeConfig.medusaPublishableKey);

  const { cart } = await medusa.store.cart.retrieve(prepared.medusaCartId, {
    fields: '*payment_collection,*items,*region,*shipping_methods',
  } as any);

  await medusa.store.payment.initiatePaymentSession(cart, {
    provider_id: prepared.selectedProviderId,
  } as any);

  const orderResult = await medusa.store.cart.complete(prepared.medusaCartId) as any;
  if (orderResult?.type !== 'order' || !orderResult?.order?.id) {
    return { error: 'Cart completion did not create an order', code: 'CHECKOUT_FAILED' };
  }

  return {
    orderResult,
    summary: prepared.summary,
  };
}
