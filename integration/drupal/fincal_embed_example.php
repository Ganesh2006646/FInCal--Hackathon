<?php

declare(strict_types=1);

/**
 * Drupal 10.5.6 / PHP 8.1 compatible render array snippet.
 *
 * Usage:
 * - Place in a custom module/controller or block builder callback.
 * - Replace the URL with your deployed Next.js host.
 */
function fincal_embed_render_array(): array {
  return [
    '#type' => 'inline_template',
    '#template' => '<div class="fincal-shell"><iframe src="{{ src }}" title="Life-Proof Retirement Calculator" loading="lazy" style="width:100%;min-height:1900px;border:0;border-radius:16px;" allow="clipboard-read; clipboard-write"></iframe></div>',
    '#context' => [
      'src' => 'https://fin-cal-hackathon.vercel.app/',
    ],
    '#cache' => [
      'max-age' => 0,
    ],
  ];
}
