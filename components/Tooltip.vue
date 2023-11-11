<template>
    <div class="tt-wrapper">
        <slot />

        <span class="tt-content">
            <slot name="tooltip" />
        </span>
    </div>
</template>

<style scoped>
.tt-wrapper {
    position: relative;
    display: inline-block;
}

.tt-content {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.7s;

    background-color: #555;
    color: #fff;
    min-width: 300px;
    border-radius: 4px;
    padding: 10px 10px;

    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    margin-left: -120px;
}

.tt-wrapper:hover .tt-content {
    visibility: visible;
    opacity: 1;
}

</style>
